// Alt text has to tell a screen-reader user something. Presence alone is not enough.

const MAX_ALT = 300;
const FILE_NAME = /\.(png|jpe?g|webp|gif|svg)$|^(img|dsc|screenshot)[\s_-]*\d*$/i;
const GENERIC = new Set(["a", "an", "the", "of", "image", "images", "photo", "picture", "pic", "banner", "graphic", "logo", "poster", "img", "screenshot", "post"]);

/** Says what is wrong with some alt text, or null when it is usable. */
export function altProblem(alt: string | null | undefined): string | null {
  const text = (alt ?? "").trim();
  if (!text) return "Image has no alt text, so screen-reader users get nothing.";
  if (FILE_NAME.test(text)) return `“${text}” is a file name, not a description of the image.`;
  if (text.length > MAX_ALT) return `Alt text is ${text.length} characters. Keep it under ${MAX_ALT} so it can be listened to.`;
  const useful = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !GENERIC.has(w));
  if (useful.length < 2) return `“${text}” doesn't say what the image shows. Describe it, including any words on it.`;
  return null;
}
