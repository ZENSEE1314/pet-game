"""
Rewrite prisma/seed.ts so that the file contains only ASCII bytes.

Why this exists: on Windows, `tsx` reads the seed file using the system ANSI codepage
rather than UTF-8, which turns an emoji or an accented character in a *data string*
into mojibake before it ever reaches the database ("Cafe" became "CafA(c)"). Escaping
every non-ASCII character in the source means the file's meaning no longer depends on
what codepage the machine happens to be using, which is the only version of this that
is actually portable.

Run: python scripts/asciify-seed.py
"""

import pathlib

SEED = pathlib.Path(__file__).resolve().parent.parent / "prisma" / "seed.ts"

COMMENT_REPLACEMENTS = {
    "’": "'",
    "‘": "'",
    "“": '"',
    "”": '"',
    "—": "--",
    "–": "-",
    "…": "...",
    "✓": "[ok]",
    "✅": "[done]",
    "❌": "[fail]",
    "\U0001f331": "[seed]",
}


def escape(char: str) -> str:
    codepoint = ord(char)
    if codepoint > 0xFFFF:
        return "\\u{%X}" % codepoint
    return "\\u%04X" % codepoint


def main() -> None:
    source = SEED.read_text(encoding="utf-8")
    out_lines = []

    for line in source.split("\n"):
        stripped = line.lstrip()
        is_comment = stripped.startswith(("//", "*", "/*"))

        if is_comment:
            for original, ascii_form in COMMENT_REPLACEMENTS.items():
                line = line.replace(original, ascii_form)
            line = "".join(c if ord(c) < 128 else "?" for c in line)
        else:
            # Code lines get ESCAPED, never substituted. Substituting here would turn a
            # typographic apostrophe inside a data string into a plain `'` and close the
            # string literal early — which is exactly the bug this once shipped.
            line = "".join(c if ord(c) < 128 else escape(c) for c in line)

        out_lines.append(line)

    SEED.write_text("\n".join(out_lines), encoding="ascii")

    assert all(byte < 128 for byte in SEED.read_bytes()), "seed.ts still contains non-ASCII"
    print("prisma/seed.ts is now pure ASCII")


if __name__ == "__main__":
    main()
