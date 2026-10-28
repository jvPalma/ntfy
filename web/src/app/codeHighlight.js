// Fork: syntax highlighting for fenced code blocks (Monokai Night colours live in /static/css/fork.css).
// Loaded lazily by MarkdownContent.jsx, only when a block names a known language.
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const languages = { bash, cpp, csharp, go, javascript, json, kotlin, markdown, python, typescript, xml, yaml };
Object.entries(languages).forEach(([name, language]) => hljs.registerLanguage(name, language));

// Same aliases as the Android fork (util/Prism.java)
const aliases = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  html: "xml",
  svg: "xml",
  markup: "xml",
  py: "python",
  kt: "kotlin",
  yml: "yaml",
  golang: "go",
  cs: "csharp",
  "c++": "cpp",
  md: "markdown",
};

// Larger blocks are shown as plain text, so one huge message cannot freeze the page
export const MAX_HIGHLIGHT_LENGTH = 20000;

// Returns the registered language for a fence name, or null
export const resolveLanguage = (name) => {
  if (!name) {
    return null;
  }
  const lower = name.toLowerCase();
  const resolved = aliases[lower] ?? lower;
  return Object.hasOwn(languages, resolved) ? resolved : null;
};

// Returns highlighted HTML (every source character escaped by highlight.js), or null when the
// language is unknown or the code is too long
export const highlight = (code, name) => {
  const language = resolveLanguage(name);
  if (!language || code.length > MAX_HIGHLIGHT_LENGTH) {
    return null;
  }
  return hljs.highlight(code, { language, ignoreIllegals: true }).value;
};
