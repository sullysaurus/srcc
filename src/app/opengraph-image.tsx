import { ImageResponse } from "next/og";

export const alt =
  "Southern Revelry Command Center — sales, advertising, and search in one operating view";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#eee9dd",
        color: "#171915",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage:
            "linear-gradient(rgba(23,25,21,.045) 1px, transparent 1px)",
          backgroundSize: "100% 32px",
        }}
      />

      <div
        style={{
          width: 356,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 52px 48px",
          backgroundColor: "#171915",
          color: "#f8f3e8",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              width: 78,
              height: 78,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              backgroundColor: "#f2bb3f",
              color: "#171915",
              fontFamily: "serif",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: -1,
              boxShadow: "8px 8px 0 #ef725f",
              transform: "rotate(3deg)",
            }}
          >
            SR
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 42,
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "serif",
                fontSize: 46,
                lineHeight: 0.92,
                letterSpacing: -1.5,
              }}
            >
              Southern
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "serif",
                fontSize: 46,
                lineHeight: 0.92,
                letterSpacing: -1.5,
              }}
            >
              Revelry
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 12,
              letterSpacing: 4,
              color: "rgba(248,243,232,.5)",
            }}
          >
            OPERATIONS LEDGER
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 13,
            color: "rgba(248,243,232,.58)",
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              display: "flex",
              borderRadius: 99,
              backgroundColor: "#68c6bc",
              marginRight: 11,
            }}
          />
          One source of operational truth
        </div>
      </div>

      <div
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "66px 68px 54px 72px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -86,
            top: -92,
            width: 310,
            height: 310,
            display: "flex",
            borderRadius: 999,
            border: "44px solid rgba(104,198,188,.18)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3.5,
              color: "#ef725f",
            }}
          >
            THE COMMAND CENTER
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 34,
              fontFamily: "serif",
              fontSize: 78,
              lineHeight: 0.98,
              letterSpacing: -3.8,
            }}
          >
            <div style={{ display: "flex" }}>Run the business.</div>
            <div style={{ display: "flex" }}>See what’s real.</div>
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 660,
              marginTop: 30,
              fontSize: 24,
              lineHeight: 1.35,
              color: "rgba(23,25,21,.62)",
            }}
          >
            Sales pipeline, paid media, and organic search in one honest
            operating view.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(23,25,21,.18)",
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            {["SALES PIPELINE", "GOOGLE ADS", "SEARCH CONSOLE"].map(
              (label, index) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    border: "1px solid rgba(23,25,21,.18)",
                    borderRadius: 99,
                    padding: "11px 16px",
                    backgroundColor:
                      index === 0 ? "#f2bb3f" : "rgba(248,243,232,.72)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.4,
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#ef725f",
            }}
          >
            ↗
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
