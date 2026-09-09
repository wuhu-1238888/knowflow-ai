import type { SVGProps } from "react";

/* 线性几何图标:1.5px 笔画,16px 基准(DesignSystem 组件规格「Icon」)。
   禁止 emoji 与拟物图标;新增图标沿用同一视觉参数。 */

function Base({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconQuestion(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M6 6.1a2 2 0 0 1 3.6 1.1c0 1.5-2 1.8-2 3" />
      <path d="M8 11.7v.01" />
    </Base>
  );
}

export function IconFiles(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M2 4.5h4.2l1.4 2H14v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
    </Base>
  );
}

export function IconGauge(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M2 13a6 6 0 1 1 12 0" />
      <path d="M8 13l2.8-3.4" />
    </Base>
  );
}

export function IconInfo(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.4v3.8" />
      <path d="M8 4.9v.01" />
    </Base>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 4.5h10M3 8h10M3 11.5h10" />
    </Base>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Base>
  );
}

export function IconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="5.5" y="5.5" width="7" height="7.5" rx="1" />
      <path d="M10.5 5.5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h1.5" />
    </Base>
  );
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12.8 8a4.8 4.8 0 1 1-1.4-3.4" />
      <path d="M13.6 2.6v2.4h-2.4" />
    </Base>
  );
}

export function IconThumbUp(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3.2 7.2v7.4h2.9" />
      <path d="M6.1 7.2V5.9a2.2 2.2 0 0 1 2.2-2.2c.5 0 .8.4.7.9l-.6 2.2h3.2c1 0 1.7 1 1.4 2l-.8 2.7a1.9 1.9 0 0 1-1.8 1.3H6.1" />
    </Base>
  );
}

export function IconThumbDown(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3.2 8.8V1.4h2.9" />
      <path d="M6.1 8.8v1.3a2.2 2.2 0 0 0 2.2 2.2c.5 0 .8-.4.7-.9l-.6-2.2h3.2c1 0 1.7-1 1.4-2l-.8-2.7a1.9 1.9 0 0 0-1.8-1.3H6.1" />
    </Base>
  );
}

export function IconUpload(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M8 11V3" />
      <path d="M5 6l3-3 3 3" />
      <path d="M3 10.5V12a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12v-1.5" />
    </Base>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M2.5 4.5h11" />
      <path d="M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1" />
      <path d="M4 4.5l.7 8a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4l.7-8" />
      <path d="M6.8 7.5v4M9.2 7.5v4" />
    </Base>
  );
}
