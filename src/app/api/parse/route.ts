import { BadRequest, enforceLimits, handle, ok } from "@/lib/api";
import { clientKey, LIMITS } from "@/lib/rate-limit";

export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Turn an uploaded DOCX, PDF, Markdown or text file into plain text.
 * Files are parsed in memory and never executed or stored.
 */
export const POST = handle(async (req: Request) => {
  await enforceLimits([`parse:${clientKey(req)}`, LIMITS.parseFile]);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new BadRequest("Attach a file.");
  if (file.size > MAX_BYTES) throw new BadRequest("Files must be 5 MB or smaller.");
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (name.endsWith(".docx")) {
    if (buf.subarray(0, 2).toString("latin1") !== "PK") throw new BadRequest("That doesn't look like a real .docx file.");
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (name.endsWith(".pdf")) {
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new BadRequest("That doesn't look like a real PDF.");
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const out = await extractText(pdf, { mergePages: true });
    text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
  } else if (/\.(md|markdown|txt)$/.test(name)) {
    text = buf.toString("utf8");
  } else {
    throw new BadRequest("Supported files: .docx, .pdf, .md, .txt");
  }

  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new BadRequest("No readable text found in that file.");
  return ok({ text: text.slice(0, 60000), name: file.name, truncated: text.length > 60000 });
});
