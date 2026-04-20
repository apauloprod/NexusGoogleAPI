import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { db } from "../firebase"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { AuthContext } from "../App"
import { useContext } from "react"

interface Client {
  id: string
  name: string
  email?: string
}

interface ClientSearchSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ClientSearchSelect({ value, onValueChange, placeholder = "Select client...", disabled }: ClientSearchSelectProps) {
  const { currentUserData, impersonatedUser } = useContext(AuthContext);
  const [open, setOpen] = React.useState(false)
  const [clients, setClients] = React.useState<Client[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const q = query(
      collection(db, "clients"), 
      where("businessId", "==", businessId),
      orderBy("name", "asc")
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email
      }))
      setClients(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [currentUserData?.businessId, impersonatedUser?.businessId])

  const selectedClient = clients.find((client) => client.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 text-white font-normal"
        >
          {selectedClient ? selectedClient.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-black border-white/10">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search clients..." className="h-9" />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => {
                    onValueChange(client.id)
                    setOpen(false)
                  }}
                  className="text-white hover:bg-white/10 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === client.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{client.name}</span>
                    {client.email && <span className="text-[10px] text-muted-foreground">{client.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
