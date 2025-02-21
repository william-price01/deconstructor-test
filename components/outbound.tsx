import { Button } from "@/components/ui/button";
import { CodeIcon, GithubIcon, HouseIcon, LucideProps, TwitterIcon } from "lucide-react";
import Link from "next/link";
import { RefAttributes } from "react";
import DocsSheet from "@/components/docs-sheet";

function OutboundButton({
  href,
  Icon,
}: {
  href: string;
  Icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
}) {
  return (
    <Button size="icon" variant="outline">
      <Link href={href}>
        <Icon className="w-4 h-4" />
      </Link>
    </Button>
  );
}

export default function Outbound() {
  return (
    <div className="absolute top-5 right-5 z-50">
      <div className="flex gap-1">
        <OutboundButton href="/" Icon={HouseIcon} />
        <DocsSheet />
        <OutboundButton
          href="https://github.com/kyleroche/deconstructor"
          Icon={GithubIcon}
        />
        <OutboundButton href="https://x.com/griptapeai" Icon={TwitterIcon} />
      </div>
    </div>
  );
}
