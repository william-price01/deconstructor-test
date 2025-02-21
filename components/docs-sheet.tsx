"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import Spinner from "@/components/spinner";
import { CodeIcon, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ProcessedSection {
    type: 'code' | 'imports' | 'region';
    content: string[];
    id: string;
    title?: string;
    description?: string;
}

function processCode(code: string): ProcessedSection[] {
    const lines = code.split('\n');
    const sections: ProcessedSection[] = [];
    let currentCode: string[] = [];
    let importLines: string[] = [];
    let inRegion = false;
    let regionTitle = '';
    let regionDescription: string[] = [];
    let regionContent: string[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Handle region markers
        if (trimmedLine.startsWith('#region ')) {
            if (currentCode.length > 0) {
                sections.push({
                    type: 'code',
                    content: currentCode,
                    id: Math.random().toString(36).substring(7)
                });
                currentCode = [];
            }
            inRegion = true;
            regionTitle = trimmedLine.substring(8);
            continue;
        }

        if (trimmedLine === '#endregion') {
            if (regionContent.length > 0) {
                sections.push({
                    type: 'region',
                    title: regionTitle,
                    description: regionDescription.join('\n'),
                    content: regionContent,
                    id: Math.random().toString(36).substring(7)
                });
            }
            inRegion = false;
            regionTitle = '';
            regionDescription = [];
            regionContent = [];
            continue;
        }

        // Collect region description (docstring)
        if (inRegion && (trimmedLine.startsWith('"""') || trimmedLine.startsWith("'''"))) {
            let isCollectingDesc = true;
            while (isCollectingDesc && regionDescription.length < lines.length) {
                const descLine = lines[regionDescription.length + 1];
                if (descLine.trim().endsWith('"""') || descLine.trim().endsWith("'''")) {
                    isCollectingDesc = false;
                } else {
                    regionDescription.push(descLine);
                }
            }
            continue;
        }

        // Handle imports and regular code
        if (inRegion) {
            regionContent.push(line);
        } else if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
            importLines.push(line);
        } else {
            if (importLines.length > 0) {
                sections.push({
                    type: 'imports',
                    content: importLines,
                    id: Math.random().toString(36).substring(7)
                });
                importLines = [];
            }
            currentCode.push(line);
        }
    }

    // Handle remaining content
    if (currentCode.length > 0) {
        sections.push({
            type: 'code',
            content: currentCode,
            id: Math.random().toString(36).substring(7)
        });
    }

    return sections;
}

export default function DocsSheet() {
    const [sections, setSections] = useState<ProcessedSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetch(process.env.NEXT_PUBLIC_DOCS_URL!)
            .then((res) => res.text())
            .then((text) => {
                setSections(processCode(text));
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load docs:", err);
                setLoading(false);
            });
    }, []);

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getDisplayContent = () => {
        return sections.map(section => {
            if (section.type === 'region' || section.type === 'imports') {
                const isExpanded = expandedSections.has(section.id);
                if (isExpanded) {
                    return [
                        `# --- ${section.title || section.type} ---`,
                        section.description ? `"""\n${section.description}\n"""` : '',
                        ...section.content,
                        `# --- End ${section.title || section.type} ---`
                    ].join('\n');
                } else {
                    return [
                        `# --- ${section.title || section.type} (click to expand) ---`,
                        section.description ? `# ${section.description.split('\n')[0]}...` : ''
                    ].join('\n');
                }
            }
            return section.content.join('\n');
        }).join('\n');
    };

    const handleLineClick = (lineNumber: number) => {
        let currentLine = 0;
        for (const section of sections) {
            const sectionLines = (section.type === 'region' || section.type === 'imports')
                ? (expandedSections.has(section.id)
                    ? section.content.length + 4  // +4 for header, description, and footer
                    : 2)  // Header and collapsed description
                : section.content.length;

            if (currentLine <= lineNumber && lineNumber < currentLine + sectionLines) {
                if (section.type === 'region' || section.type === 'imports') {
                    toggleSection(section.id);
                }
                break;
            }
            currentLine += sectionLines;
        }
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button size="icon" variant="outline">
                    <CodeIcon className="h-4 w-4" />
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetTitle className="text-lg font-semibold mb-4">
                    Implementation Details
                </SheetTitle>
                <div className="flex flex-col h-[calc(100%-3rem)]">
                    {loading ? (
                        <div className="flex items-center justify-center flex-1">
                            <Spinner />
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1">
                            <SyntaxHighlighter
                                language="python"
                                style={{
                                    ...oneDark,
                                    'pre[class*="language-"]': {
                                        ...oneDark['pre[class*="language-"]'],
                                        background: 'transparent',
                                        margin: 0,
                                        padding: '1rem',
                                    },
                                    'code[class*="language-"]': {
                                        ...oneDark['code[class*="language-"]'],
                                        background: 'transparent',
                                    },
                                }}
                                wrapLines={true}
                                lineProps={(lineNumber) => ({
                                    style: {
                                        background: 'transparent',
                                        cursor: 'pointer',
                                    },
                                    onClick: () => handleLineClick(lineNumber),
                                })}
                                showLineNumbers
                                customStyle={{
                                    fontSize: '12px',
                                }}
                            >
                                {getDisplayContent()}
                            </SyntaxHighlighter>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
} 