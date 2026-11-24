import { ImageResponse } from "next/og";
import { ScoutSparkSvg } from "@/components/scout-spark-svg";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<ScoutSparkSvg size={32} />, { ...size });
}
