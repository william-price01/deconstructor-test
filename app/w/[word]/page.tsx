import WordDeconstructor from "@/components/deconstructor";

export default async function WordPage({
  params,
}: {
  params: Promise<{ word: string }>;
}) {
  const word = (await params).word;

  if (!word) {
    return <div>No word provided</div>;
  }

  return <WordDeconstructor word={word} />;
}
