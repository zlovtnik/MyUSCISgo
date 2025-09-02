package main

import (
	"MyUSCISgo/internal/wasm"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	handler := wasm.NewHandler()
	handler.RegisterFunctions()

	// In development mode, wait for interrupt signal
	// In WASM mode, this will be a no-op and the program will stay alive
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	select {
	case <-c:
		// Received interrupt signal, exit gracefully
		return
	case <-time.After(30 * time.Second):
		// Timeout after 30 seconds in development mode
		return
	}
}
