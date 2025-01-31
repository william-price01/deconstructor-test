type TextWidthFn = {
  (text: string, font: string): number;
  element?: HTMLSpanElement;
};

export const getTextWidth: TextWidthFn = function (
  text: string,
  font: string
): number {
  // re-use span element for better performance
  const element =
    getTextWidth.element ||
    (getTextWidth.element = document.createElement("span"));

  // Style the element to measure text accurately
  element.style.font = font;
  element.style.position = "absolute";
  element.style.whiteSpace = "nowrap";
  // element.style.visibility = "hidden";
  element.textContent = text;

  if (!document.body.contains(element)) {
    const main = document.querySelector("main");
    if (main) {
      main.appendChild(element);
    } else {
      document.body.appendChild(element);
    }

    console.log(element);
  }

  const width = element.clientWidth;
  console.log(`width  for "${text}":`, width);
  return width;
};

function getCssStyle(element: HTMLElement, prop: string): string {
  return window.getComputedStyle(element, null).getPropertyValue(prop);
}

export function getCanvasFont(el: HTMLElement = document.body): string {
  const fontWeight = getCssStyle(el, "font-weight") || "normal";
  const fontSize = getCssStyle(el, "font-size") || "16px";
  const fontFamily = getCssStyle(el, "font-family") || "Times New Roman";

  return `${fontWeight} ${fontSize} ${fontFamily}`;
}
