"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StudioSelect({value, onValueChange, options, label}: {value: number; onValueChange: (value: number) => void; options: {value: number; label: string}[]; label: string}) {
  return <Select value={String(value)} onValueChange={value => onValueChange(Number(value))}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent className="acp-popover">{options.map(option => <SelectItem value={String(option.value)} key={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
