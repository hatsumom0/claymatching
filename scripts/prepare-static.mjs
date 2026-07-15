import { constants } from "node:fs";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "site");
const outputRoot = path.join(root, "dist");

const isDeployable = (source) => {
  const segments = path.relative(sourceRoot, source).split(path.sep);
  return path.basename(source) !== ".DS_Store" && !segments.some((segment) => segment.endsWith("-src"));
};

async function copyTree(source, destination) {
  if (!isDeployable(source)) return;
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (!isDeployable(from)) continue;
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      try {
        await copyFile(from, to, constants.COPYFILE_FICLONE);
      } catch (error) {
        if (!["EINVAL", "ENOSYS", "ENOTSUP", "EXDEV"].includes(error?.code)) throw error;
        await copyFile(from, to);
      }
    }
  }
}

await rm(outputRoot, { recursive: true, force: true });
await copyTree(sourceRoot, outputRoot);
console.log("Claymatching static bundle staged in dist/.");
