import PublicDemo from "./public-demo";

export const metadata = {
  title: "Nova Clinic OS — Public Demo",
  description: "Explore a read-only preview of the Nova Clinic OS workspace.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <PublicDemo />;
}
