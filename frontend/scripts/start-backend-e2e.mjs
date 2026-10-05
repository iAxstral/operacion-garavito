// Levanta el backend (perfil dev, H2) en el puerto que se pase, para las pruebas e2e.
// Es un script aparte porque en Windows la ruta del proyecto tiene espacios y
// parentesis, y el comando de Playwright no lo resuelve bien con cmd.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = process.argv[2] ?? '8099';
const backendDir = fileURLToPath(new URL('../../backend/', import.meta.url));
const windows = process.platform === 'win32';

const args = `-q spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.arguments=--server.port=${Number(port)}`;
// ".\mvnw.cmd" explicito: algunos entornos no buscan ejecutables en la carpeta actual.
const child = windows
  ? spawn(`.\\mvnw.cmd ${args}`, { cwd: backendDir, stdio: 'inherit', shell: true })
  : spawn('./mvnw', args.split(' '), { cwd: backendDir, stdio: 'inherit' });

const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
