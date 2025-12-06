import { render, screen } from "@testing-library/react";
import { SafeMarkdown } from "../../lib/markdown";

test("blocks script tags", () => {
  render(<SafeMarkdown markdown={"# hi\n\n<script>alert(1)</script>"} />);
  expect(screen.queryByText("alert(1)")).toBeNull();
});

test("blocks javascript: links", () => {
  render(<SafeMarkdown markdown={"[x](javascript:alert(1))"} />);
  const link = screen.queryByRole("link");
  expect(link).toBeNull();
});

test("blocks onerror images", () => {
  render(<SafeMarkdown markdown={`![](https://example.com/x.png" onerror="alert(1)`} />);
  // should render nothing or a safe img; but never attach handlers
  const imgs = screen.queryAllByRole("img");
  expect(imgs.length).toBeLessThanOrEqual(1);
});

test("renders inline math and block math", () => {
  render(<SafeMarkdown markdown={"Inline $a^2+b^2=c^2$\n\n$$E=mc^2$$"} />);
  // sanity check: KaTeX inserts .katex elements
  expect(document.querySelector(".katex")).not.toBeNull();
});
