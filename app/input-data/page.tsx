import type { Metadata } from "next";
import { SpeechDashboard } from "../speech-dashboard";

export const metadata: Metadata = {
  title: "Input Data | Prabowo Speech Watch",
  description: "Panel admin untuk mengelola jadwal pidato.",
};

export default function InputDataPage() {
  return <SpeechDashboard adminMode />;
}
