"use client";

import { cn } from "../../lib/utils";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import {
  escapeHtmlOutsideCodeBlocks,
  safeRehypePlugins,
  streamdownComponents,
  streamdownRootClass,
} from "./streamdown";

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-full flex-col gap-1 overflow-hidden text-sm",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

/** User message content with bubble styling */
export type UserMessageContentProps = HTMLAttributes<HTMLDivElement>;

export const UserMessageContent = ({
  children,
  className,
  ...props
}: UserMessageContentProps) => {
  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-oc-surface-hover px-4 py-3 text-sm",
        "dark:bg-oc-surface/30",
        className,
      )}
      {...props}
    >
      <div className="whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
};

export type MessageResponseProps = ComponentProps<typeof Streamdown> & {
  mode?: "streaming" | "static";
  parseIncompleteMarkdown?: boolean;
};

export const MessageResponse = memo(
  ({
    className,
    children,
    mode = "static",
    parseIncompleteMarkdown = false,
    ...props
  }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        streamdownRootClass,
        className,
      )}
      components={streamdownComponents}
      rehypePlugins={safeRehypePlugins}
      mode={mode}
      parseIncompleteMarkdown={parseIncompleteMarkdown}
      {...props}
    >
      {typeof children === "string"
        ? escapeHtmlOutsideCodeBlocks(children)
        : children}
    </Streamdown>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageResponse.displayName = "MessageResponse";
