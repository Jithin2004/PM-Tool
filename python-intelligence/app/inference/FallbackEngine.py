class FallbackEngine:
    def trigger_fallback(self, reason):
        return {"status": "fallback_triggered", "reason": reason}
