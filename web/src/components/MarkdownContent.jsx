import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useRemark } from "react-remark";
import remarkGfm from "remark-gfm";
import styled from "@emotion/styled";
import { useTranslation } from "react-i18next";
import { copyToClipboard, sanitizeUrl } from "../app/utils";

// Strip unsafe URL protocols (javascript:, data:, ...) from links and images. Without
// this, React blocks javascript: URLs at render time and throws an uncaught "React has
// blocked a javascript: URL" error.
const SafeLink = ({ href, children, ...props }) => (
  <a href={sanitizeUrl(href)} {...props}>
    {children}
  </a>
);

const SafeImage = ({ src, alt, ...props }) => <img src={sanitizeUrl(src)} alt={alt} {...props} />;

// Fork: code blocks with Monokai Night highlighting (codeHighlight.js, styles in /static/css/fork.css)
// and a copy button. useRemark captures its options once, so the copy-error callback comes
// through context instead of a prop on the component.
const CopyErrorContext = createContext(() => {});

// Fork: hast-to-hyperscript (under rehype-react) recognises React by `_owner`/`_store` on a probe
// element, which React 19 production builds no longer set. Without this it falls back to plain
// hyperscript props (`class`, string `style`), so code languages are lost and GFM tables crash.
// The probe is the only call without props; every real call goes to React unchanged.
const createElement = (type, props, children) =>
  props === undefined ? { ...React.createElement(type), _store: {} } : React.createElement(type, props, children);

const textOf = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  return textOf(node.props?.children);
};

const CodeBlock = ({ children }) => {
  const { t } = useTranslation();
  const onCopyError = useContext(CopyErrorContext);
  const codeElement = React.Children.toArray(children).find((child) => child.type === "code");
  const className = codeElement?.props.className ?? "";
  const language = /(?:^|\s)language-(\S+)/.exec(className)?.[1];
  const code = textOf(codeElement ?? children).replace(/\n$/, "");
  const [html, setHtml] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    if (language) {
      import("../app/codeHighlight").then(({ highlight }) => {
        if (!cancelled) {
          setHtml(highlight(code, language));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (event) => {
    event.stopPropagation();
    try {
      await copyToClipboard(code);
      setCopied(true);
    } catch (e) {
      console.log(`[MarkdownContent] Copying code failed`, e);
      onCopyError();
    }
  };

  return (
    <div className="ntfy-code-wrap">
      <button type="button" className="ntfy-code-copy" onClick={handleCopy} aria-label={t("notifications_code_copy_label")}>
        {copied ? `\u{F012C} ${t("notifications_code_copied")}` : `\u{F018F} ${t("notifications_code_copy")}`}
      </button>
      <pre className="ntfy-code">
        {/* highlight.js escapes every character of the code; only its own spans are added */}
        {html !== null ? (
          <code className={className} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className={className}>{code}</code>
        )}
      </pre>
    </div>
  );
};

const MarkdownContainer = styled("div")`
  line-height: 1;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  pre,
  ul,
  ol,
  blockquote {
    margin: 0;
  }

  p {
    line-height: 1.5;
  }

  blockquote {
    border-radius: 3px;
    background: ${(props) => (props.theme.palette.mode === "light" ? "#f5f5f5" : "#333")};
  }

  ul,
  ol,
  blockquote {
    padding-inline: 1rem;
  }

  img {
    max-width: 100%;
  }
`;

// Renders text/markdown notification bodies. react-remark (and its remark/unified
// dependency stack) is heavy, so this component lives in its own module and is loaded
// lazily by Notifications.jsx -- it only ships when a markdown message is actually shown.
const MarkdownContent = ({ content, onCopyError }) => {
  const [reactContent, setMarkdownSource] = useRemark({
    remarkPlugins: [remarkGfm], // Fork: GFM tables
    rehypeReactOptions: { createElement, components: { a: SafeLink, img: SafeImage, pre: CodeBlock } }, // Fork: createElement, pre
  });

  useEffect(() => {
    setMarkdownSource(content);
  }, [content]);

  // Fork: ntfy-markdown scopes the table and code styles in /static/css/fork.css
  return (
    <CopyErrorContext.Provider value={onCopyError ?? (() => {})}>
      <MarkdownContainer className="ntfy-markdown">{reactContent}</MarkdownContainer>
    </CopyErrorContext.Provider>
  );
};

export default MarkdownContent;
