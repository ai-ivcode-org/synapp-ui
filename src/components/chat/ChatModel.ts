export type Sender = 'user' | 'assistant'

export interface Message {
    id: number
    text: string
    sender: Sender
    time: number
}