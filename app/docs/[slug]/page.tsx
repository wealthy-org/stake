import { redirect } from "next/navigation";

export default function DocSlugPage({ params }: { params: { slug: string } }) {
  redirect(`/#docs/${params.slug}`);
}
