import { cn } from "../../lib/utils";
import type { Element } from "hast";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";
import type { StreamdownProps } from "streamdown";
import { defaultRehypePlugins } from "streamdown";
import { CodeBlock } from "./code-block";

// Selectively enable rehype plugins while maintaining security.
// The default plugins include:
// - 'raw': renders raw HTML embedded in markdown (XSS risk - DISABLED)
// - 'harden': sanitizes HTML (strips tags, which loses content like <script> - DISABLED)
// - 'sanitize': HTML sanitization
// - 'katex': math rendering (SAFE - only processes math syntax $...$ and $$...$$)
// We only enable katex to support math formula rendering while keeping HTML-like
// text displayed as-is for security.
export const safeRehypePlugins: StreamdownProps["rehypePlugins"] = [
  defaultRehypePlugins.katex, // Enable math formula rendering
];

/**
 * Escape HTML-like tags outside of code blocks to prevent XSS and preserve
 * markdown structure. HTML tags like <script>, <img>, etc. break markdown
 * parsing (especially numbered lists) because remark treats them as HTML nodes.
 *
 * This function:
 * 1. Preserves content inside code blocks (```...``` and `...`)
 * 2. Escapes both < and > in HTML-like tags elsewhere
 */
export const escapeHtmlOutsideCodeBlocks = (text: string): string => {
  // Match ONLY valid fenced code blocks (``` at line start) and inline code.
  // Mid-line ``` is a syntax error and should be treated as plain text.
  // Fenced code blocks: ``` at line start, optional language, content, then \n```
  // Also match inline code: `..` (single backticks, no newlines inside)
  const codeBlockRegex = /(^|\n)```[a-z]*\n[\s\S]*?\n```|`[^`\n]+`/g;
  const codeBlocks: { start: number; end: number }[] = [];

  // Find all valid code blocks
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Adjust start position if match includes leading newline
    const startsWithNewline = match[0].startsWith("\n");
    const start = startsWithNewline ? match.index + 1 : match.index;
    codeBlocks.push({ start, end: match.index + match[0].length });
  }

  // Escape content outside code blocks to prevent markdown from misinterpreting it.
  const escapeForMarkdown = (str: string): string => {
    // 1. Escape HTML-like tags with fullwidth Unicode equivalents (＜ and ＞)
    //    which look nearly identical but won't be parsed as HTML tags.
    let result = str.replace(/<(?=[a-zA-Z/!?])/g, "＜");
    // Exclude line-start > (blockquotes) and arrows (-> and =>)
    result = result.replace(/(?<!^)(?<![-=])>/gm, "＞");

    // 2. Prevent indented code blocks: insert zero-width space after newline
    //    before 4+ spaces. This breaks the CommonMark indented code block pattern.
    result = result.replace(/\n([ ]{4,})/g, "\n\u200B$1");

    return result;
  };

  // Process text, escaping content outside code blocks
  const result: string[] = [];
  let lastEnd = 0;

  for (const block of codeBlocks) {
    // Process text before this code block
    const before = text.slice(lastEnd, block.start);
    result.push(escapeForMarkdown(before));
    // Keep code block unchanged
    result.push(text.slice(block.start, block.end));
    lastEnd = block.end;
  }

  // Process remaining text after last code block
  const after = text.slice(lastEnd);
  result.push(escapeForMarkdown(after));

  return result.join("");
};

// Prevent Streamdown margins from collapsing, which can break Virtuoso height measurement.
export const streamdownRootClass = [
  "flow-root",
  "[&_p]:m-0",
  "[&_h1]:m-0",
  "[&_h2]:m-0",
  "[&_h3]:m-0",
  "[&_h4]:m-0",
  "[&_h5]:m-0",
  "[&_h6]:m-0",
  "[&_ul]:m-0",
  "[&_ol]:m-0",
  "[&_li]:m-0",
  "[&_blockquote]:m-0",
  "[&_hr]:m-0",
  "[&_pre]:m-0",
  "[&_table]:m-0",
].join(" ");

const LANGUAGE_CLASS_RE = /language-([^\s]+)/;

const getCodeLanguage = (className?: string): string | undefined => {
  const match = className?.match(LANGUAGE_CLASS_RE);
  return match?.[1];
};

const getCodeText = (children: ReactNode): string => {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(getCodeText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return getCodeText(children.props.children);
  }
  return "";
};

type StreamdownCodeProps = ComponentProps<"code"> & { node?: Element };

const StreamdownCode = ({
  className,
  children,
  node,
  ...props
}: StreamdownCodeProps) => {
  const isInline = node?.position?.start?.line === node?.position?.end?.line;

  if (isInline) {
    return (
      <code
        className={cn(
          "rounded bg-oc-surface-hover px-1 py-0.5 font-mono text-xs",
          className,
        )}
        data-streamdown="inline-code"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <CodeBlock
      className={cn("my-2", className)}
      code={getCodeText(children)}
      language={getCodeLanguage(className)}
      {...props}
    />
  );
};

const StreamdownPre = ({ children }: ComponentProps<"pre">) => children;

// Table components - matching kimi-cli style
const StreamdownTable = ({ children, className, ...props }: ComponentProps<"table">) => (
  <div className="overflow-x-auto my-4">
    <table
      className={cn(
        "w-full border-collapse border border-oc-border text-sm",
        className
      )}
      {...props}
    >
      {children}
    </table>
  </div>
);

const StreamdownThead = ({ children, className, ...props }: ComponentProps<"thead">) => (
  <thead className={cn("bg-oc-surface-hover", className)} {...props}>
    {children}
  </thead>
);

const StreamdownTh = ({ children, className, ...props }: ComponentProps<"th">) => (
  <th
    className={cn(
      "border border-oc-border px-3 py-2 text-left font-semibold",
      className
    )}
    {...props}
  >
    {children}
  </th>
);

const StreamdownTd = ({ children, className, ...props }: ComponentProps<"td">) => (
  <td className={cn("border border-oc-border px-3 py-2", className)} {...props}>
    {children}
  </td>
);

const StreamdownTr = ({ children, className, ...props }: ComponentProps<"tr">) => (
  <tr className={cn("border-b border-oc-border", className)} {...props}>
    {children}
  </tr>
);

// List components
const StreamdownUl = ({ children, className, ...props }: ComponentProps<"ul">) => (
  <ul className={cn("list-disc pl-6 my-2 space-y-1", className)} {...props}>
    {children}
  </ul>
);

const StreamdownOl = ({ children, className, ...props }: ComponentProps<"ol">) => (
  <ol className={cn("list-decimal pl-6 my-2 space-y-1", className)} {...props}>
    {children}
  </ol>
);

const StreamdownLi = ({ children, className, ...props }: ComponentProps<"li">) => (
  <li className={cn("leading-relaxed", className)} {...props}>
    {children}
  </li>
);

// Heading components
const StreamdownH1 = ({ children, className, ...props }: ComponentProps<"h1">) => (
  <h1 className={cn("text-2xl font-bold my-4", className)} {...props}>
    {children}
  </h1>
);

const StreamdownH2 = ({ children, className, ...props }: ComponentProps<"h2">) => (
  <h2 className={cn("text-xl font-bold my-3", className)} {...props}>
    {children}
  </h2>
);

const StreamdownH3 = ({ children, className, ...props }: ComponentProps<"h3">) => (
  <h3 className={cn("text-lg font-bold my-2", className)} {...props}>
    {children}
  </h3>
);

const StreamdownH4 = ({ children, className, ...props }: ComponentProps<"h4">) => (
  <h4 className={cn("text-base font-semibold my-2", className)} {...props}>
    {children}
  </h4>
);

// Paragraph
const StreamdownP = ({ children, className, ...props }: ComponentProps<"p">) => (
  <p className={cn("my-2 leading-relaxed", className)} {...props}>
    {children}
  </p>
);

// Blockquote
const StreamdownBlockquote = ({ children, className, ...props }: ComponentProps<"blockquote">) => (
  <blockquote
    className={cn(
      "border-l-2 border-oc-text-muted pl-4 italic my-4 text-oc-text-muted",
      className
    )}
    {...props}
  >
    {children}
  </blockquote>
);

// Link
const StreamdownA = ({ children, className, href, ...props }: ComponentProps<"a">) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={cn("text-oc-primary hover:underline", className)}
    {...props}
  >
    {children}
  </a>
);

// Horizontal rule
const StreamdownHr = ({ className, ...props }: ComponentProps<"hr">) => (
  <hr className={cn("my-4 border-oc-border", className)} {...props} />
);

export const streamdownComponents: StreamdownProps["components"] = {
  code: StreamdownCode,
  pre: StreamdownPre,
  table: StreamdownTable,
  thead: StreamdownThead,
  th: StreamdownTh,
  td: StreamdownTd,
  tr: StreamdownTr,
  ul: StreamdownUl,
  ol: StreamdownOl,
  li: StreamdownLi,
  h1: StreamdownH1,
  h2: StreamdownH2,
  h3: StreamdownH3,
  h4: StreamdownH4,
  p: StreamdownP,
  blockquote: StreamdownBlockquote,
  a: StreamdownA,
  hr: StreamdownHr,
};
