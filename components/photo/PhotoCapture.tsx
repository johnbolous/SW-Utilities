"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, RotateCcw, Check, AlertTriangle } from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Button, Badge } from "@/components/ui/primitives";
import type { ReadingEntityType } from "@/types/database";

type Stage = "empty" | "preview" | "uploading" | "warning" | "accepted" | "error";

interface Props {
  entityType: ReadingEntityType;
  entityId: string;
  readingDate: string; // YYYY-MM-DD
  onAccepted: (photoId: string) => void;
}

export function PhotoCapture({ entityType, entityId, readingDate, onAccepted }: Props) {
  const { lang } = useThemeLang();
  const { t } = useTranslation(lang);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleFileSelected(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setStage("preview");
    setReasons([]);
    setErrorMsg(null);
  }

  function reset() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStage("empty");
    setReasons([]);
    setErrorMsg(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function upload(force: boolean) {
    if (!file) return;
    setStage("uploading");
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);
    formData.append("readingDate", readingDate);
    formData.append("force", String(force));

    try {
      const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
      const body = await res.json();

      if (res.status === 422) {
        setReasons(body.reasons ?? []);
        setStage("error");
        return;
      }
      if (body.status === "warning") {
        setReasons(body.reasons ?? []);
        setStage("warning");
        return;
      }
      if (body.status === "saved") {
        setStage("accepted");
        onAccepted(body.photo.id);
        return;
      }
      setErrorMsg(t("photoUploadFailed"));
      setStage("preview");
    } catch {
      setErrorMsg(t("photoUploadFailed"));
      setStage("preview");
    }
  }

  return (
    <div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />

      {stage === "empty" && (
        <div className="flex flex-col gap-2">
          <Button onClick={() => cameraInputRef.current?.click()} className="w-full">
            <Camera size={18} /> {t("takePhoto")}
          </Button>
          <Button variant="secondary" onClick={() => galleryInputRef.current?.click()} className="w-full">
            <ImageIcon size={18} /> {t("chooseExistingPhoto")}
          </Button>
          <div className="text-xs text-brand-gray">{t("noPhotoYet")}</div>
        </div>
      )}

      {(stage === "preview" || stage === "uploading" || stage === "warning" || stage === "error") && previewUrl && (
        <div>
          <img
            src={previewUrl}
            alt={t("photoPreview")}
            className="w-full max-h-80 object-contain rounded-lg border border-border mb-3 bg-surface-soft"
          />

          {stage === "warning" && (
            <div className="mb-3 p-3 rounded-lg bg-solar/10 border border-solar/30">
              <div className="flex items-center gap-2 text-solar font-display font-semibold text-sm mb-1">
                <AlertTriangle size={16} /> {t("qualityWarningTitle")}
              </div>
              <div className="text-xs text-brand-gray">{t("qualityWarningBody")}</div>
            </div>
          )}

          {stage === "error" && (
            <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
              {reasons.join(" ")}
            </div>
          )}

          {errorMsg && <div className="mb-3 text-sm text-danger">{errorMsg}</div>}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} disabled={stage === "uploading"} className="flex-1">
              <RotateCcw size={16} /> {stage === "warning" ? t("retake") : t("retakePhoto")}
            </Button>
            {stage === "warning" ? (
              <Button onClick={() => upload(true)} disabled={stage as string === "uploading"} className="flex-1">
                {t("continueAnyway")}
              </Button>
            ) : stage !== "error" ? (
              <Button onClick={() => upload(false)} disabled={stage as string === "uploading"} className="flex-1">
                <Check size={16} /> {stage === "uploading" ? t("uploadingPhoto") : t("acceptPhoto")}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {stage === "accepted" && (
        <div className="flex items-center gap-2">
          {previewUrl && (
            <img src={previewUrl} alt={t("photoPreview")} className="w-16 h-16 object-cover rounded-lg border border-border" />
          )}
          <Badge tone="success">
            <Check size={12} className="inline -mt-0.5" /> {t("photoAccepted")}
          </Badge>
        </div>
      )}
    </div>
  );
}
