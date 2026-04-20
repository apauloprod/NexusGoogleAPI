import React, { useEffect, useRef } from "react";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddressData {
  full: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onAddressSelect?: (data: AddressData) => void;
  className?: string;
  placeholder?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  className,
  placeholder = "Enter an address...",
}: AddressAutocompleteProps) {
  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue: setInputValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: "us" },
    },
    debounce: 300,
    defaultValue: value,
  });

  const [open, setOpen] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value, false);
    }
  }, [value, setInputValue]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (description: string) => {
    setInputValue(description, false);
    clearSuggestions();
    setOpen(false);
    onChange(description);

    if (onAddressSelect) {
      try {
        const results = await getGeocode({ address: description });
        const addressComponents = results[0].address_components;
        
        const getComponent = (type: string) => 
          addressComponents.find((c: any) => c.types.includes(type))?.long_name || "";

        const streetNumber = getComponent("street_number");
        const route = getComponent("route");
        const city = getComponent("locality");
        const state = getComponent("administrative_area_level_1");
        const zip = getComponent("postal_code");
        
        onAddressSelect({
          full: description,
          street: streetNumber && route ? `${streetNumber} ${route}` : description,
          city,
          state,
          zip
        });
      } catch (error) {
        console.error("Error parsing address details:", error);
        onAddressSelect({ full: description });
      }
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <Input
        value={inputValue}
        onChange={(e) => {
          const val = e.target.value;
          setInputValue(val);
          setOpen(true);
          onChange(val);
        }}
        onFocus={() => {
          if (status === "OK") setOpen(true);
        }}
        placeholder={placeholder}
        className={cn("bg-white/5 border-white/10 w-full rounded-xl", className)}
      />
      
      {open && status === "OK" && (
        <div className="absolute z-[999] w-full mt-2 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-auto py-2 backdrop-blur-xl">
          <ul className="space-y-1">
            {data.map(({ place_id, description }) => (
              <li
                key={place_id}
                onClick={() => handleSelect(description)}
                className="px-4 py-2.5 text-sm text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                {description}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {open && status !== "OK" && status !== "ZERO_RESULTS" && inputValue.length > 5 && (
        <div className="absolute z-[999] w-full mt-2 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-4 text-sm text-muted-foreground font-medium backdrop-blur-xl">
          No matches found for your search.
        </div>
      )}
    </div>
  );
}
