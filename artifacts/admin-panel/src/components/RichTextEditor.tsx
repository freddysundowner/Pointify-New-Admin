import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  RemoveFormatting,
} from "lucide-react";

interface RichTextEditorProps {
  id?: string;
  /** Current HTML value. The editor is semi-controlled: external changes (e.g. selecting a template) update the content. */
  value: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
}

/**
 * Small dependency-free rich text editor built on contentEditable +
 * document.execCommand (deprecated but universally supported for this basic
 * formatting set: bold/italic/underline/lists/links).
 */
export function RichTextEditor({ id, value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value changes (template selection, reset) into the editor
  // without clobbering the caret while the user is typing.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML, el.innerText);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("Link URL (e.g. https://pointifypos.com)");
    if (url && /^https?:\/\//i.test(url.trim())) {
      exec("createLink", url.trim());
    }
  };

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1">
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bold" onClick={() => exec("bold")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Italic" onClick={() => exec("italic")}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Underline" onClick={() => exec("underline")}>
          <Underline className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bulleted list" onClick={() => exec("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Insert link" onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Clear formatting" onClick={() => exec("removeFormat")}>
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>
      <div
        id={id}
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className="min-h-[220px] max-w-none px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}
