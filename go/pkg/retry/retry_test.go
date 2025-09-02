package retry

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

// Test notes:
// - Framework: Go standard library testing package (testing).
// - No external test libraries asserted in repo scan; avoiding new deps per instructions.

// Helper to make near-time assertions with generous tolerance for CI environments.
func within(d time.Duration, max time.Duration) bool {
	if d < 0 {
		return false
	}
	return d <= max
}

func TestDefaultConfig_ReturnsExpectedValues(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.MaxAttempts != 3 {
		t.Fatalf("MaxAttempts = %d, want 3", cfg.MaxAttempts)
	}
	if cfg.BaseDelay != 1*time.Second {
		t.Fatalf("BaseDelay = %v, want 1s", cfg.BaseDelay)
	}
	if cfg.MaxDelay != 30*time.Second {
		t.Fatalf("MaxDelay = %v, want 30s", cfg.MaxDelay)
	}
	if cfg.BackoffFactor != 2.0 {
		t.Fatalf("BackoffFactor = %v, want 2.0", cfg.BackoffFactor)
	}
}

func TestDo_SucceedsImmediately_DoesSingleAttempt(t *testing.T) {
	ctx := context.Background()
	cfg := &Config{
		MaxAttempts:   5,
		BaseDelay:     10 * time.Millisecond,
		MaxDelay:      50 * time.Millisecond,
		BackoffFactor: 2.0,
	}
	var calls int32
	op := func() error {
		atomic.AddInt32(&calls, 1)
		return nil
	}
	if err := Do(ctx, cfg, op); err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("operation called %d times, want 1", got)
	}
}

func TestDo_EventualSuccess_ReturnsNilAndStops(t *testing.T) {
	ctx := context.Background()
	cfg := &Config{
		MaxAttempts:   5,
		BaseDelay:     0, // eliminate waits to keep test fast
		MaxDelay:      0,
		BackoffFactor: 2.0,
	}
	var calls int32
	failThenSucceed := func() error {
		n := atomic.AddInt32(&calls, 1)
		if n < 3 {
			return errors.New("temporary")
		}
		return nil
	}
	if err := Do(ctx, cfg, failThenSucceed); err != nil {
		t.Fatalf("Do returned error, want nil: %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("operation called %d times, want 3 (2 failures then success)", got)
	}
}

func TestDo_ExhaustsAttempts_ReturnsLastError(t *testing.T) {
	ctx := context.Background()
	cfg := &Config{
		MaxAttempts:   3,
		BaseDelay:     0, // no real sleeping
		MaxDelay:      0,
		BackoffFactor: 2.0,
	}
	var calls int32
	err1 := errors.New("err-1")
	err2 := errors.New("err-2")
	err3 := errors.New("err-3")
	op := func() error {
		switch atomic.AddInt32(&calls, 1) {
		case 1:
			return err1
		case 2:
			return err2
		default:
			return err3
		}
	}
	got := Do(ctx, cfg, op)
	if !errors.Is(got, err3) {
		t.Fatalf("Do() error = %v, want last error %v", got, err3)
	}
	if c := atomic.LoadInt32(&calls); c != 3 {
		t.Fatalf("operation called %d times, want 3", c)
	}
}

func TestDo_ContextCanceledBeforeStart_ReturnsContextError_NoCalls(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel before invoking Do

	cfg := &Config{
		MaxAttempts:   3,
		BaseDelay:     5 * time.Millisecond,
		MaxDelay:      10 * time.Millisecond,
		BackoffFactor: 2.0,
	}
	var calls int32
	op := func() error {
		atomic.AddInt32(&calls, 1)
		return nil
	}
	err := Do(ctx, cfg, op)
	if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Do() err = %v, want context cancellation error", err)
	}
	if got := atomic.LoadInt32(&calls); got != 0 {
		t.Fatalf("operation called %d times, want 0", got)
	}
}

func TestDo_ContextCanceledDuringBackoff_ReturnsContextError(t *testing.T) {
	// Create a cancellable context and cancel during the sleep between attempts.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := &Config{
		MaxAttempts:   3,                    // attempts: 0,1,2 ; only attempt 1 will have non-zero delay
		BaseDelay:     25 * time.Millisecond, // base
		MaxDelay:      100 * time.Millisecond,
		BackoffFactor: 2.0,                  // attempt 1 delay = 25ms * (2*1) = 50ms
	}
	var calls int32
	op := func() error {
		atomic.AddInt32(&calls, 1)
		return errors.New("fail")
	}

	// Cancel shortly after Do starts, to fire during the backoff of attempt 1.
	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	err := Do(ctx, cfg, op)
	elapsed := time.Since(start)

	if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Do() err = %v, want context cancellation error", err)
	}
	if c := atomic.LoadInt32(&calls); c < 1 {
		t.Fatalf("operation called %d times, want at least 1", c)
	}
	// Ensure we didn't wait the full non-canceled backoff (50ms) after cancellation.
	if elapsed > 120*time.Millisecond {
		t.Fatalf("elapsed=%v, expected cancellation to return earlier than 120ms", elapsed)
	}
}

func TestDo_NoSleepOnLastAttempt_TotalElapsedNearExpected(t *testing.T) {
	// With MaxAttempts=3, only attempt #1 (second try) incurs non-zero delay per current formula:
	// delay = BaseDelay * (BackoffFactor * attempt)
	// attempt 0 => 0; attempt 1 => BaseDelay * (2 * 1) = 40ms; attempt 2 (last) => no sleep.
	cfg := &Config{
		MaxAttempts:   3,
		BaseDelay:     20 * time.Millisecond,
		MaxDelay:      1 * time.Second,
		BackoffFactor: 2.0,
	}
	ctx := context.Background()
	var calls int32
	op := func() error {
		atomic.AddInt32(&calls, 1)
		return errors.New("still failing")
	}

	start := time.Now()
	_ = Do(ctx, cfg, op)
	elapsed := time.Since(start)

	if atomic.LoadInt32(&calls) != 3 {
		t.Fatalf("operation called %d times, want 3", calls)
	}

	expectedDelay := 40 * time.Millisecond // only attempt #1 sleeps
	// Assert we didn't incur an extra sleep after last attempt.
	if !(elapsed >= expectedDelay && elapsed < expectedDelay+80*time.Millisecond) {
		t.Fatalf("elapsed=%v, want in [%v, %v)", elapsed, expectedDelay, expectedDelay+80*time.Millisecond)
	}
}

func TestDo_DelayClampedToMaxDelay(t *testing.T) {
	// Configure a very large computed delay that should be clamped to MaxDelay.
	cfg := &Config{
		MaxAttempts:   3,
		BaseDelay:     500 * time.Millisecond,
		MaxDelay:      30 * time.Millisecond, // clamp target
		BackoffFactor: 3.0,                   // attempt 1 delay = 500ms * (3*1) = 1500ms -> clamp to 30ms
	}
	ctx := context.Background()
	op := func() error { return errors.New("fail") }

	start := time.Now()
	_ = Do(ctx, cfg, op)
	elapsed := time.Since(start)

	// Only one clamped sleep (30ms) should be observed.
	if !within(elapsed, 150*time.Millisecond) { // allow generous CI jitter
		t.Fatalf("elapsed=%v, expected to be <=150ms (only one clamped sleep of ~30ms)", elapsed)
	}
}

func TestDo_BaseDelayZero_YieldsNoWaiting(t *testing.T) {
	cfg := &Config{
		MaxAttempts:   3,
		BaseDelay:     0,
		MaxDelay:      0,
		BackoffFactor: 2.0,
	}
	ctx := context.Background()
	op := func() error { return errors.New("fail") }

	start := time.Now()
	_ = Do(ctx, cfg, op)
	elapsed := time.Since(start)

	if elapsed > 50*time.Millisecond {
		t.Fatalf("elapsed=%v, expected near-zero wait when BaseDelay is 0", elapsed)
	}
}

func TestDo_MaxAttemptsZero_NoCallsAndNoError(t *testing.T) {
	cfg := &Config{
		MaxAttempts:   0, // loop won't execute
		BaseDelay:     10 * time.Millisecond,
		MaxDelay:      10 * time.Millisecond,
		BackoffFactor: 2.0,
	}
	ctx := context.Background()
	var calls int32
	op := func() error {
		atomic.AddInt32(&calls, 1)
		return nil
	}
	if err := Do(ctx, cfg, op); err != nil {
		t.Fatalf("Do() err = %v, want nil when MaxAttempts=0", err)
	}
	if got := atomic.LoadInt32(&calls); got != 0 {
		t.Fatalf("operation called %d times, want 0 when MaxAttempts=0", got)
	}
}