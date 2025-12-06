import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { defaultSchema } from "hast-util-sanitize";
import "katex/dist/katex.min.css";
import "highlight.js/styles/vs2015.css";

// Extend sanitize schema minimally for KaTeX + code highlight classes
const schema = {
  ...defaultSchema,
  // Explicitly ensure headings are allowed (they should be in defaultSchema, but being explicit)
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      // allow KaTeX + highlight classnames
      ["className"]
    ],
    code: [
      ...(defaultSchema.attributes?.code || []),
      ["className"] // e.g., language-ts
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["href"], ["title"], ["rel"], ["target"]
    ],
    img: [
      ["src"], ["alt"], ["title"] // no width/height/onerror
    ]
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"] // image data URLs only
  }
};

type SafeMarkdownProps = {
  markdown: string;
};

export function SafeMarkdown({ markdown }: SafeMarkdownProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        // SECURITY: do not parse raw HTML blocks
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeSanitize, schema],
          rehypeKatex,
          rehypeHighlight
        ]}
        components={{
          h1: ({ ...props }: any) => <h1 className="text-2xl font-bold mb-2 mt-4" {...props} />,
          h2: ({ ...props }: any) => <h2 className="text-xl font-bold mb-2 mt-3" {...props} />,
          h3: ({ ...props }: any) => <h3 className="text-lg font-semibold mb-2 mt-3" {...props} />,
          h4: ({ ...props }: any) => <h4 className="text-base font-semibold mb-1 mt-2" {...props} />,
          h5: ({ ...props }: any) => <h5 className="text-sm font-semibold mb-1 mt-2" {...props} />,
          h6: ({ ...props }: any) => <h6 className="text-sm font-medium mb-1 mt-2" {...props} />,
          p: ({ ...props }: any) => <p className="mb-2" {...props} />,
          a: ({ ...props }: any) => (
            <a
              {...props}
              className="text-blue-600 hover:text-blue-800 underline"
              rel="noopener noreferrer nofollow"
              target="_blank"
            />
          ),
          img: ({ ...props }: any) => <img {...props} loading="lazy" className="max-w-full h-auto" />,
          ul: ({ ...props }: any) => <ul className="list-disc list-inside mb-2 ml-4" {...props} />,
          ol: ({ ...props }: any) => <ol className="list-decimal list-inside mb-2 ml-4" {...props} />,
          li: ({ ...props }: any) => <li className="mb-1" {...props} />,
          blockquote: ({ ...props }: any) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2" {...props} />
          ),
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              const inlineClassName = [
                "bg-gray-100 px-1 py-0.5 rounded text-sm font-mono",
                className,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <code className={inlineClassName} {...props}>
                  {children}
                </code>
              );
            }

            // Block code: ensure background is controlled by <pre>, keep inner transparent
            const blockClassName = [
              "text-gray-100 font-mono",
              className,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <code
                className={blockClassName}
                style={{ background: "transparent" }}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ className, children, ...props }: any) => {
            const combinedClassName = [
              "bg-gray-900 text-gray-100 p-2 rounded text-sm font-mono mb-2 overflow-x-auto",
              className,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <pre className={combinedClassName} {...props}>
                {children}
              </pre>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
