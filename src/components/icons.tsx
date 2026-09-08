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
