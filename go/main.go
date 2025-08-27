package main

import (
	"MyUSCISgo/internal/wasm"
)

func main() {
	handler := wasm.NewHandler()
	handler.RegisterFunctions()

	// Keep the program running
	select {}
}
