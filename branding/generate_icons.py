"""Genera todos los iconos de RedSana desde las dos fuentes de branding/ (requiere Pillow).

Uso, desde la raíz del frontend:  python branding/generate_icons.py
Todo lo configurable (tamaños, rutas, colores) vive en branding/brand.json.
"""
import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

BRANDING_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class BrandConfig:
    raw: dict

    @classmethod
    def load(cls, path: Path) -> "BrandConfig":
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def path(self, relative: str) -> Path:
        return (BRANDING_DIR / relative).resolve()

    def section(self, name: str) -> dict:
        return self.raw[name]

    def __getitem__(self, key: str):
        return self.raw[key]


class IconRenderer:
    """Dibuja un icono cuadrado: hasta compactMaxSize usa el escudo sin anillos, que se lee mejor en chico."""

    def __init__(self, config: BrandConfig) -> None:
        self._full = Image.open(config.path(config["sources"]["full"])).convert("RGB")
        self._compact = Image.open(config.path(config["sources"]["compact"])).convert("RGB")
        self._compact_max_size = config["compactMaxSize"]
        self._background = config["iconBackground"]

    def render(self, size: int, padding_ratio: float, variant: str | None = None) -> Image.Image:
        # variant fuerza la fuente cuando el tamaño en pantalla no es el de los píxeles (p. ej. un asset @3x).
        if variant is None:
            variant = "compact" if size <= self._compact_max_size else "full"
        source = self._compact if variant == "compact" else self._full
        content = max(1, round(size * (1 - 2 * padding_ratio)))
        canvas = Image.new("RGB", (size, size), self._background)
        offset = (size - content) // 2
        canvas.paste(source.resize((content, content), Image.LANCZOS), (offset, offset))
        return canvas


class PwaIconWriter:
    """Iconos de la web: PNG normales y maskable, apple-touch-icon, favicon y la lista de iconos del manifest."""

    def __init__(self, config: BrandConfig, renderer: IconRenderer) -> None:
        self._config = config
        self._pwa = config.section("pwa")
        self._renderer = renderer
        self._directory = config.path(self._pwa["directory"])
        self._public_root = config.path(self._pwa["publicRoot"])

    def write(self) -> list[Path]:
        self._directory.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        manifest_icons = []
        for size in self._pwa["sizes"]:
            path = self._save(self._renderer.render(size, self._config["paddingRatio"]), f"icon-{size}x{size}.png")
            written.append(path)
            manifest_icons.append(self._manifest_entry(path, size, "any"))
        # Maskable: el símbolo queda dentro de la zona segura (círculo del 80 % central) que el sistema puede recortar.
        for size in self._pwa["maskableSizes"]:
            path = self._save(self._renderer.render(size, self._config["maskablePaddingRatio"]), f"icon-maskable-{size}x{size}.png")
            written.append(path)
            manifest_icons.append(self._manifest_entry(path, size, "maskable"))
        apple_size = self._pwa["appleTouchSize"]
        written.append(self._save(self._renderer.render(apple_size, self._config["paddingRatio"]), "apple-touch-icon.png"))
        written.append(self._write_favicon())
        self._update_manifest_icons(manifest_icons)
        return written

    def _save(self, image: Image.Image, name: str) -> Path:
        path = self._directory / name
        image.save(path, optimize=True)
        return path

    def _manifest_entry(self, path: Path, size: int, purpose: str) -> dict:
        return {
            "src": path.relative_to(self._public_root).as_posix(),
            "sizes": f"{size}x{size}",
            "type": "image/png",
            "purpose": purpose,
        }

    def _write_favicon(self) -> Path:
        favicon = self._config.section("favicon")
        sizes = favicon["sizes"]
        frames = [self._renderer.render(size, self._config["paddingRatio"]) for size in sizes]
        path = self._config.path(favicon["path"])
        # Cada fotograma va dibujado a su tamaño (no reescalado desde el mayor) para que el chico use el escudo compacto.
        frames[-1].save(path, format="ICO", sizes=[(s, s) for s in sizes], append_images=frames[:-1])
        return path

    def _update_manifest_icons(self, icons: list[dict]) -> None:
        path = self._config.path(self._pwa["manifest"])
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest["icons"] = icons
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class BrandMarkWriter:
    """La marca de la barra superior y del login: se ve chica, así que va con el escudo compacto aunque el PNG sea @3x."""

    def __init__(self, config: BrandConfig, renderer: IconRenderer) -> None:
        self._mark = config.section("brandMark")
        self._renderer = renderer
        self._path = config.path(self._mark["path"])

    def write(self) -> list[Path]:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        image = self._renderer.render(self._mark["size"], self._mark["paddingRatio"], self._mark["variant"])
        image.save(self._path, optimize=True)
        return [self._path]


class TauriIconWriter:
    """Set del instalador con el CLI de Tauri (ya es devDependency); luego redibujo lo chico con el escudo compacto."""

    def __init__(self, config: BrandConfig, renderer: IconRenderer) -> None:
        self._config = config
        self._tauri = config.section("tauri")
        self._renderer = renderer
        self._directory = config.path(self._tauri["iconsDirectory"])

    def write(self) -> list[Path]:
        self._run_tauri_cli()
        # Lo que el CLI genera de más y el instalador no usa: dejo el mismo set que lista tauri.conf.json.
        for name in self._tauri["generatedEntriesToDiscard"]:
            entry = self._directory / name
            if entry.is_dir():
                shutil.rmtree(entry)
            else:
                entry.unlink(missing_ok=True)
        written = [self._redraw_if_small(path) for path in sorted(self._directory.glob("*.png"))]
        written.append(self._write_ico())
        written.append(self._directory / "icon.icns")
        return written

    def _run_tauri_cli(self) -> None:
        npx = shutil.which("npx")
        if npx is None:
            raise RuntimeError("npx not found: install Node.js to regenerate the Tauri icons")
        size = self._tauri["cliSourceSize"]
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "app-icon.png"
            self._renderer.render(size, self._config["paddingRatio"]).save(source)
            subprocess.run([npx, "--no-install", "tauri", "icon", str(source), "--output", str(self._directory)],
                           cwd=BRANDING_DIR.parent, check=True, capture_output=True)

    def _redraw_if_small(self, path: Path) -> Path:
        with Image.open(path) as image:
            size = image.width
        if size <= self._config["compactMaxSize"]:
            self._renderer.render(size, self._config["paddingRatio"]).save(path, optimize=True)
        return path

    def _write_ico(self) -> Path:
        ico = self._tauri["ico"]
        sizes = ico["sizes"]
        frames = [self._renderer.render(size, self._config["paddingRatio"]) for size in sizes]
        path = self._directory / ico["file"]
        frames[-1].save(path, format="ICO", sizes=[(s, s) for s in sizes], append_images=frames[:-1])
        return path


class ThemeColorSync:
    """El color del manifest y del <meta theme-color> sale del token de fondo del tema oscuro, nunca escrito a mano."""

    def __init__(self, config: BrandConfig) -> None:
        self._config = config
        self._theme = config.section("theme")

    def token_value(self) -> str:
        tokens = self._config.path(self._theme["tokensFile"]).read_text(encoding="utf-8")
        block = tokens.split(self._theme["selector"], 1)[1].split("}", 1)[0]
        match = re.search(re.escape(self._theme["token"]) + r":\s*([^;]+);", block)
        if match is None:
            raise ValueError(f"token {self._theme['token']} not found under {self._theme['selector']}")
        return match.group(1).strip()

    def write(self) -> list[Path]:
        color = self.token_value()
        manifest_path = self._config.path(self._theme["manifest"])
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["theme_color"] = color
        manifest["background_color"] = color
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        index_path = self._config.path(self._theme["indexHtml"])
        # Leo y escribo bytes para conservar los saltos de línea originales del archivo.
        html = index_path.read_bytes().decode("utf-8")
        html = re.sub(r'(<meta name="theme-color" content=")[^"]*(")', lambda m: f"{m.group(1)}{color}{m.group(2)}", html)
        index_path.write_bytes(html.encode("utf-8"))
        return [manifest_path, index_path]


class BrandAssetsGenerator:
    def __init__(self, config: BrandConfig) -> None:
        renderer = IconRenderer(config)
        self._writers = [
            PwaIconWriter(config, renderer),
            BrandMarkWriter(config, renderer),
            TauriIconWriter(config, renderer),
            ThemeColorSync(config),
        ]

    def run(self) -> None:
        for writer in self._writers:
            for path in writer.write():
                print(f"[branding] {path.relative_to(BRANDING_DIR.parent).as_posix()}")


if __name__ == "__main__":
    BrandAssetsGenerator(BrandConfig.load(BRANDING_DIR / "brand.json")).run()
