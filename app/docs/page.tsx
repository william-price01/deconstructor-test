"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import Spinner from "@/components/spinner";

export default function DocsPage() {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(process.env.NEXT_PUBLIC_DOCS_URL!)
            .then((res) => res.text())
            .then((text) => {
                setContent(text);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load docs:", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-8 prose prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
    );
} 