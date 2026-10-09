use std::process::Command;

/// Proceso de consola de Windows sin ventana: sin esto cada escaneo hacía parpadear una ventana negra.
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
