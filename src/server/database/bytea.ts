import { Buffer } from "node:buffer";

export function toPostgresBytea(value: Buffer): string {
  return `\\x${value.toString("hex")}`;
}

export function fromPostgresBytea(value: unknown): Buffer | null {
  if (typeof value !== "string" || !/^\\x[0-9a-f]*$/i.test(value)) {
    return null;
  }

  return Buffer.from(value.slice(2), "hex");
}
