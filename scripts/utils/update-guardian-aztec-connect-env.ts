import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUARDIAN_AZTEC_CONNECT_DIR = path.join(
  __dirname,
  "../../services/guardian-aztec-connect"
);
const GUARDIAN_AZTEC_CONNECT_ENV_PATH = path.join(
  GUARDIAN_AZTEC_CONNECT_DIR,
  ".env"
);
const GUARDIAN_AZTEC_CONNECT_ENV_EXAMPLE_PATH = path.join(
  GUARDIAN_AZTEC_CONNECT_DIR,
  ".env.example"
);

interface LoggerLike {
  info: (msg: string) => void;
}

async function upsertEnvValue(
  filePath: string,
  key: string,
  value: string
): Promise<void> {
  const nextLine = `${key}=${value}`;

  let content = "";
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;
    if (readError.code !== "ENOENT") {
      throw error;
    }
  }

  const keyPattern = new RegExp(`^${key}=.*$`, "m");
  const updatedContent = keyPattern.test(content)
    ? content.replace(keyPattern, nextLine)
    : `${content}${content && !content.endsWith("\n") ? "\n" : ""}${nextLine}\n`;

  await fs.writeFile(filePath, updatedContent, "utf8");
}

export async function updateGuardianAztecConnectEnv(
  certificateRegistryAddress: string,
  logger: LoggerLike
): Promise<void> {
  try {
    await fs.access(GUARDIAN_AZTEC_CONNECT_ENV_PATH);
  } catch (error) {
    const accessError = error as NodeJS.ErrnoException;
    if (accessError.code !== "ENOENT") {
      throw error;
    }

    logger.info(
      `📝 Creating guardian connect env from example: ${GUARDIAN_AZTEC_CONNECT_ENV_PATH}`
    );
    const exampleContent = await fs.readFile(
      GUARDIAN_AZTEC_CONNECT_ENV_EXAMPLE_PATH,
      "utf8"
    );
    await fs.writeFile(
      GUARDIAN_AZTEC_CONNECT_ENV_PATH,
      exampleContent,
      "utf8"
    );
  }

  await upsertEnvValue(
    GUARDIAN_AZTEC_CONNECT_ENV_PATH,
    "CERTIFICATE_REGISTRY_ADDRESS",
    certificateRegistryAddress
  );
  logger.info(
    `📝 Saved CERTIFICATE_REGISTRY_ADDRESS to ${GUARDIAN_AZTEC_CONNECT_ENV_PATH}`
  );
}
