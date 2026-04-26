"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  usePortal?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  usePortal = false,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (isOpen && usePortal && triggerRef.current) {
      const toggle = triggerRef.current.previousElementSibling;
      if (toggle) {
        const rect = toggle.getBoundingClientRect();
        setCoords({
          top: rect.bottom,
          right: document.documentElement.clientWidth - rect.right,
        });
      }
    } else {
      setCoords(null);
    }
  }, [isOpen, usePortal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".dropdown-toggle")
      ) {
        onClose();
      }
    };

    const handleScroll = (event: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={dropdownRef}
      style={usePortal && coords ? { top: coords.top, right: coords.right } : {}}
      className={`${usePortal ? "fixed" : "absolute"} z-[9999] right-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark ${className}`}
    >
      {children}
    </div>
  );

  if (usePortal) {
    return (
      <>
        <div ref={triggerRef} style={{ display: "none" }} />
        {typeof document !== "undefined" && coords ? createPortal(content, document.body) : null}
      </>
    );
  }

  return content;
};
