use std::process::Command;

/// Proceso de consola de Windows (ipconfig, arp, netsh) que se ejecuta sin
/// abrir ventana. La app de escritorio no tiene consola propia (windows_subsystem
/// = "windows"), así que cada Command::new a secas mostraba una ventana negra que
/// aparecía y se cerraba al instante en cada escaneo.
pub(crate) fn hidden_console_command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn hidden_command_still_runs_and_captures_output() {
        let output = hidden_console_command("ipconfig").output().expect("ipconfig should launch");
        assert!(output.status.success());
        assert!(!output.stdout.is_empty());
    }
}
