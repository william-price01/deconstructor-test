import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";

export default function Modal({
    isOpen,
    onClose,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent>
                <SheetTitle>Events Log</SheetTitle>
                <SheetDescription>
                    Event log showing observability data and events from the word deconstruction process
                </SheetDescription>
                <div className="flex flex-col h-[calc(100%-3rem)] overflow-y-auto mt-4">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
} 