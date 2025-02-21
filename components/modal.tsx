import {
    Sheet,
    SheetContent,
    SheetTitle,
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
                <SheetTitle className="text-lg font-semibold mb-4">
                    Events Log
                </SheetTitle>
                <div className="flex flex-col h-[calc(100%-3rem)] overflow-y-auto">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
} 