import { describe, expect, it } from "vitest";
import {
  HEADING_MARKER,
  findFurniture,
  readBlocks,
  typesetBook,
  typesetPage,
} from "./typeset";

/** A page of extracted text: one line per line of the original. */
function raw(...lines: string[]): string {
  return lines.join("\n");
}

/** A book with a running header and a page number on every page. */
function bookWith(bodyLines: string[][], header = "Chapter 4 · Blind Defence") {
  return bodyLines.map((lines, i) =>
    raw(`${header} ${100 + i}`, ...lines, String(100 + i)),
  );
}

describe("joining what extraction broke apart", () => {
  it("rejoins a sentence chopped at the right margin", () => {
    const blocks = typesetPage(
      raw(
        "Blind defence is where most small-stakes players quietly",
        "bleed money, and the reason is position rather than cards.",
      ),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe(
      "Blind defence is where most small-stakes players quietly bleed money, and the reason is position rather than cards.",
    );
  });

  it("repairs a word split across lines with a hyphen", () => {
    // Joining these with a space gives "continu ation", which is worse than the
    // damage extraction did in the first place.
    const blocks = typesetPage(
      raw(
        "The button raises with a very wide range, and the continu-",
        "ation of that pressure is what wins the pot.",
      ),
    );

    expect(blocks[0].text).toContain("continuation of that pressure");
    expect(blocks[0].text).not.toContain("continu ation");
  });

  it("keeps a real compound that happens to break at a capital", () => {
    const blocks = typesetPage(
      raw("He plays a loose-", "Aggressive style from the button."),
    );

    expect(blocks[0].text).toContain("loose-Aggressive");
  });

  it("breaks a paragraph on a short line that ends a sentence", () => {
    const blocks = typesetPage(
      raw(
        "The instinct to fold anything that looks weak is the error here.",
        "You are not trying to win the pot every single time you defend.",
        "That is the cost.",
        "Defending widely is uncomfortable and it is also correct in the long",
        "run against a button that opens half of all hands dealt to it.",
      ),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0].text.endsWith("That is the cost.")).toBe(true);
  });
});

describe("removing the furniture", () => {
  const tenPages = () =>
    bookWith(
      Array.from({ length: 10 }, () => ["Some ordinary sentence of prose here."]),
    );

  it("finds a running header that carries a changing page number", () => {
    // "Chapter 4 · 112" and "Chapter 4 · 113" are the same header. Matching on
    // the literal string is the usual reason this fails.
    expect(findFurniture(tenPages()).keys.size).toBeGreaterThan(0);
  });

  it("strips a header welded onto the first sentence", () => {
    // The real failure: "Crushing The Microstakes I grew up in Vancouver" —
    // header and body text sharing one extracted line. A whole-line filter
    // cannot touch it, so it survives into the prose on every page.
    const header = "Crushing The Microstakes";
    const pages = Array.from({ length: 12 }, (_, i) =>
      raw(
        header,
        "Some ordinary sentence of prose that runs along here.",
        String(10 + i),
      ),
    );
    // One page where extraction merged the header into the body.
    pages[3] = raw(
      `${header} I grew up in Vancouver, B.C., Canada.`,
      "Another sentence of prose follows it here.",
      "13",
    );

    const clean = typesetBook(pages);
    expect(clean[3]).toContain("I grew up in Vancouver");
    expect(clean[3]).not.toContain(header);
  });

  it("drops a website footer glued to the end of a page", () => {
    const clean = typesetBook([
      raw(
        "A sentence of prose ends the page here.",
        "www.blackrain79.com Page 12",
      ),
    ]);

    expect(clean[0]).not.toContain("blackrain79");
    expect(clean[0]).toContain("A sentence of prose");
  });

  it("strips headers and page numbers from the text", () => {
    const clean = typesetBook(tenPages());

    expect(clean[0]).toBe("Some ordinary sentence of prose here.");
    expect(clean[0]).not.toContain("Chapter 4");
    expect(clean[0]).not.toContain("100");
  });

  it("leaves a repeated line alone when it sits in the body", () => {
    // An author's refrain is the book. Deleting it would be deleting the book.
    const refrain = "Position is the whole game.";
    const pages = Array.from({ length: 10 }, () =>
      raw("Opening line of the page here.", refrain, "Closing line of the page."),
    );

    expect(typesetBook(pages)[0]).toContain(refrain);
  });

  it("does not guess at furniture in a short document", () => {
    // With four pages, repetition carries no signal at all.
    const pages = Array.from({ length: 4 }, () => raw("Header", "Body text."));
    expect(findFurniture(pages).keys.size).toBe(0);
  });

  it("never treats a long line as furniture", () => {
    const long =
      "This is a full sentence of prose that happens to repeat across pages for some reason.";
    const pages = Array.from({ length: 12 }, () => raw(long, "Body text here."));

    expect(findFurniture(pages).keys.has(long.toLowerCase())).toBe(false);
  });
});

describe("headings", () => {
  it("marks a short unpunctuated line as a heading", () => {
    const blocks = typesetPage(
      raw(
        "Defending the big blind",
        "The button opens wide, so you defend wide.",
      ),
    );

    expect(blocks[0]).toEqual({
      type: "heading",
      text: "Defending the big blind",
    });
    expect(blocks[1].type).toBe("paragraph");
  });

  it("does not treat a sentence as a heading", () => {
    const blocks = typesetPage(
      raw("The button opens wide, so you defend wide."),
    );
    expect(blocks[0].type).toBe("paragraph");
  });
});

describe("the table of contents", () => {
  it("drops entries with leader dots", () => {
    // A contents page has no argument in it. Being asked to summarise one is
    // the moment a reader decides the tool is broken.
    const clean = typesetBook([
      raw(
        "Sets . . . . . . . . . . . . . . . 197",
        "Overpairs . . . . . . . . . . . . . 199",
        "Facing Aggression With an Overpair . . . . . 203",
      ),
    ]);

    expect(clean[0]).toBe("");
  });

  it("keeps a sentence that merely ends in a number", () => {
    const clean = typesetBook([
      raw("He opened to 2.5bb from the button with a range of about 41."),
    ]);

    expect(clean[0]).toContain("41");
  });
});

describe("carrying headings through to the reader", () => {
  it("marks a heading so the structure survives storage", () => {
    const clean = typesetBook([
      raw(
        "Defending the big blind",
        "The button opens wide, so you defend wide against it.",
      ),
    ]);

    expect(clean[0].startsWith(HEADING_MARKER)).toBe(true);
  });

  it("round-trips back into blocks", () => {
    const clean = typesetBook([
      raw(
        "Defending the big blind",
        "The button opens wide, so you defend wide against it.",
      ),
    ]);
    const blocks = readBlocks(clean[0]);

    expect(blocks[0]).toEqual({
      type: "heading",
      text: "Defending the big blind",
    });
    expect(blocks[1].type).toBe("paragraph");
  });

  it("does not mistake ordinary prose for a heading", () => {
    expect(readBlocks("Just an ordinary paragraph of text.")[0].type).toBe(
      "paragraph",
    );
  });
});

describe("keeping the shape of the book", () => {
  it("returns one entry per page, blanks included", () => {
    // Page numbers have to keep lining up with the book in your hands.
    const clean = typesetBook([raw("Text."), "", raw("More text.")]);

    expect(clean).toHaveLength(3);
    expect(clean[1]).toBe("");
  });

  it("separates paragraphs with a blank line", () => {
    const clean = typesetBook([
      raw("First paragraph ends here.", "Second one starts and ends here."),
    ]);

    expect(clean[0].split("\n\n").length).toBeGreaterThan(1);
  });
});
