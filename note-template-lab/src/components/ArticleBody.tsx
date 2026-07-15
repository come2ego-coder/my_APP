export default function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="font-mincho text-[17px] font-bold text-indigo"
            >
              {block.replace(/^##\s*/, "")}
            </h3>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line text-[15px] leading-[1.9] text-sumi/85">
            {block.replace(/^##\s*/, "")}
          </p>
        );
      })}
    </div>
  );
}
