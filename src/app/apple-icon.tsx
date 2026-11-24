import { ImageResponse } from "next/og";
import { ScoutSparkSvg } from "@/components/scout-spark-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<ScoutSparkSvg size={180} square />, { ...size });
}
