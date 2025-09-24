import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import App from "./App";

test("renders name", async () => {
  const { getByText, getByAltText } = render(<App />);

  const headingTitle = "React + Vite + Supabase + Vercel";
  const headingElement = getByText(headingTitle);

  await expect.element(headingElement).toBeInTheDocument();
  expect(headingElement.element().innerHTML).toBe(headingTitle);

  // Check if logos are rendered correctly
  const reactLogo = getByAltText("React logo");
  const viteLogo = getByAltText("Vite logo");
  const supabaseLogo = getByAltText("React Supabase");
  const vercelLogo = getByAltText("React Vercel");

  await expect.element(reactLogo).toBeInTheDocument();
  await expect.element(viteLogo).toBeInTheDocument();
  await expect.element(supabaseLogo).toBeInTheDocument();
  await expect.element(vercelLogo).toBeInTheDocument();
});
