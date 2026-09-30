"use client";

import { Component, memo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { FORMAT_DIMENSIONS } from "@/lib/constants";
import { SAFE_AREA, type TemplateDefinition, type TemplatePhoto } from "@/lib/studio/types";
import { SafeAreaGuide } from "@/components/studio/templates/primitives";

/** Menangkap galat render template agar editor tetap bisa dipakai. */
export class TemplateErrorBoundary extends Component<
  { children: ReactNode; resetKey: string; compact?: boolean },
  { failed: boolean; resetKey: string }
> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { failed: boolean; resetKey: string },
  ): Partial<{ failed: boolean; resetKey: string }> | null {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error("[studio] template gagal dirender", error);
  }

  render() {
    if (this.state.failed) {
      return (
        // Ukuran dalam piksel kanvas final (1080 px) karena ikut diperkecil bersama pratinjau.
        <div
          role="alert"
          className="flex h-full w-full flex-col items-center justify-center bg-danger-soft text-center text-danger"
          style={{ gap: 32, padding: 64 }}
        >
          <TriangleAlert size={this.props.compact ? 240 : 120} aria-hidden="true" />
          <p style={{ fontSize: this.props.compact ? 96 : 56, fontWeight: 700, lineHeight: 1.2 }}>Template gagal dirender</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Render template pada ukuran final lalu perkecil dengan CSS transform.
 * Dipakai untuk kanvas pratinjau dan thumbnail galeri (thumbnail nyata).
 */
export const ScaledTemplate = memo(function ScaledTemplate({
  template,
  text,
  photos,
  scale,
  showSafeArea = false,
  compact = false,
}: {
  template: TemplateDefinition;
  text: Record<string, string>;
  photos: Record<string, TemplatePhoto>;
  scale: number;
  showSafeArea?: boolean;
  compact?: boolean;
}) {
  const { width, height } = FORMAT_DIMENSIONS[template.format];
  const Render = template.Component;
  return (
    <div
      style={{ width: Math.round(width * scale), height: Math.round(height * scale), position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <TemplateErrorBoundary resetKey={template.id} compact={compact}>
          <Render text={text} photos={photos} showSafeArea={false} />
        </TemplateErrorBoundary>
        {showSafeArea ? <SafeAreaGuide {...SAFE_AREA[template.format]} /> : null}
      </div>
    </div>
  );
});
