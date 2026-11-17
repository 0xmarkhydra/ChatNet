import { createContext } from 'react'

// Portal overlays spawned by a native modal must stay inside its top layer.
export const ModalPortalContext = createContext<HTMLElement | null>(null)
