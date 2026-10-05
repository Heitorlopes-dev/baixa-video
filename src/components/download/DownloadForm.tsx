import { useId } from "react";
import { FORMATS, FORMAT_IDS, type FormatId } from "../../lib/ytdlp";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

const FORMAT_OPTIONS = FORMAT_IDS.map((id) => ({ value: id, label: FORMATS[id].label }));

type Props = {
  url: string;
  onUrlChange: (url: string) => void;
  dir: string;
  onChooseDir: () => void;
  format: FormatId;
  onFormatChange: (format: FormatId) => void;
  /** Download ou atualização em andamento: nada pode mudar. */
  disabled: boolean;
  /** Enter no campo do link. */
  onSubmit: () => void;
};

export function DownloadForm(props: Props) {
  const urlId = useId();
  const dirId = useId();
  const formatId = useId();

  return (
    <>
      <Field label="Link do vídeo" htmlFor={urlId}>
        <TextInput
          id={urlId}
          className="outline-none focus:border-blue-500"
          placeholder="https://www.youtube.com/watch?v=..."
          value={props.url}
          disabled={props.disabled}
          onChange={(e) => props.onUrlChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") props.onSubmit();
          }}
          autoFocus
        />
      </Field>

      <Field label="Salvar em" htmlFor={dirId}>
        <div className="flex gap-2">
          <TextInput
            id={dirId}
            className="flex-1 opacity-80"
            value={props.dir}
            readOnly
            placeholder="Escolha uma pasta"
          />
          <Button variant="secondary" disabled={props.disabled} onClick={props.onChooseDir}>
            Escolher pasta
          </Button>
        </div>
      </Field>

      <Field label="Formato" htmlFor={formatId}>
        <Select
          id={formatId}
          options={FORMAT_OPTIONS}
          value={props.format}
          onValueChange={props.onFormatChange}
          disabled={props.disabled}
        />
      </Field>
    </>
  );
}
