package main

import (
	"MyUSCISgo/internal/wasm"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"
)

func main() {
	handler := wasm.NewHandler()
	handler.RegisterFunctions()

	// In WASM (js/wasm), keep the runtime alive indefinitely.
	if runtime.GOOS == "js" || runtime.GOARCH == "wasm" {
		select {}
	} else {
		// In development/native mode, wait for interrupt or timeout.
		c := make(chan os.Signal, 1)
		defer signal.Stop(c)
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
}
