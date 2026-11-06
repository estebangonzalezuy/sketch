import { useEffect, useRef, useCallback, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// ============================================================================
// MODULE-LEVEL CONSTANTS (Optimization #1: Moved outside component)
// ============================================================================

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi"]

const isVideoSource = (src: string): boolean => {
    return VIDEO_EXTENSIONS.some((ext) => src.toLowerCase().endsWith(ext))
}

// Character sets - moved outside to prevent recreation on every render
const CHARS = {
    alpha: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    numeric: "0123456789",
    symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?/~`'\"\\",
    hex: "0123456789ABCDEFabcdef",
} as const

const PATTERN_CHARS =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"

const WORD_FRAGMENTS = [
    "function",
    "const",
    "let",
    "var",
    "return",
    "async",
    "await",
    "import",
    "export",
    "class",
    "extends",
    "interface",
    "type",
    "enum",
    "struct",
    "void",
    "int",
    "char",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "default",
    "try",
    "catch",
    "throw",
    "finally",
    "new",
    "delete",
    "typeof",
    "instanceof",
    "public",
    "private",
    "protected",
    "static",
    "readonly",
    "abstract",
    "virtual",
    "null",
    "undefined",
    "true",
    "false",
    "NaN",
    "Infinity",
    "void",
    "never",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Symbol",
    "Map",
    "Set",
    "Promise",
    "Observable",
    "Stream",
    "Buffer",
    "Event",
    "Error",
    "Exception",
    "document",
    "window",
    "console",
    "process",
    "module",
    "require",
    "exports",
    "TCP",
    "HTTP",
    "HTTPS",
    "SSH",
    "FTP",
    "DNS",
    "API",
    "REST",
    "JSON",
    "XML",
    "kernel",
    "socket",
    "buffer",
    "stream",
    "pipe",
    "fork",
    "exec",
    "spawn",
    "kill",
    "malloc",
    "free",
    "sizeof",
    "typedef",
    "volatile",
    "extern",
    "inline",
    "register",
    "SELECT",
    "FROM",
    "WHERE",
    "JOIN",
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "DROP",
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "can",
    "had",
    "her",
    "was",
    "with",
    "this",
    "that",
    "have",
    "from",
    "they",
    "been",
    "would",
    "there",
    "their",
    "which",
    "when",
    "make",
    "like",
    "time",
    "just",
    "know",
    "take",
    "into",
    "year",
    "your",
    "some",
    "them",
    "than",
    "then",
    "only",
    "come",
    "over",
    "such",
    "also",
    "back",
    "after",
    "most",
    "made",
    "being",
    "where",
    "through",
    "before",
    "between",
] as const

const OPERATORS = [
    "=>",
    "->",
    "::",
    "&&",
    "||",
    "==",
    "!=",
    "<=",
    ">=",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "<<",
    ">>",
    "**",
    "?.",
    "??",
    "...",
    "|>",
    "<|",
] as const

const PUNCTUATION = ".,;:!?"

// Cache array lengths for faster access
const PATTERN_CHARS_LEN = PATTERN_CHARS.length
const WORD_FRAGMENTS_LEN = WORD_FRAGMENTS.length
const OPERATORS_LEN = OPERATORS.length
const PUNCTUATION_LEN = PUNCTUATION.length
const CHARS_HEX_LEN = CHARS.hex.length
const CHARS_SYMBOLS_LEN = CHARS.symbols.length

// ============================================================================
// MODULE-LEVEL HELPER FUNCTIONS (Optimization #4: hue2rgb moved to module scope)
// ============================================================================

const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
}

// ============================================================================
// COLOR CACHE (Optimization #5: Color string caching)
// ============================================================================

// Pre-computed alpha strings for dark/light modes (10 levels)
const DARK_ALPHA_CACHE: string[] = []
const LIGHT_ALPHA_CACHE: string[] = []
for (let i = 0; i <= 100; i++) {
    const alpha = i / 100
    DARK_ALPHA_CACHE[i] = `rgba(255, 255, 255, ${alpha.toFixed(2)})`
    LIGHT_ALPHA_CACHE[i] = `rgba(0, 0, 0, ${alpha.toFixed(2)})`
}

// Pattern alpha strings (pre-computed)
const DARK_PATTERN_ALPHA = "rgba(255, 255, 255, 0.08)"
const LIGHT_PATTERN_ALPHA = "rgba(0, 0, 0, 0.1)"

// RGB color cache for color mode (LRU-style with Map)
const COLOR_CACHE = new Map<number, string>()
const COLOR_CACHE_MAX_SIZE = 1000

const getColorCacheKey = (r: number, g: number, b: number): number => {
    // Quantize to reduce cache size (5-bit per channel = 32768 possible colors)
    const qr = (r >> 3) & 0x1f
    const qg = (g >> 3) & 0x1f
    const qb = (b >> 3) & 0x1f
    return (qr << 10) | (qg << 5) | qb
}

const getCachedColor = (r: number, g: number, b: number): string => {
    const key = getColorCacheKey(r, g, b)
    let color = COLOR_CACHE.get(key)
    if (!color) {
        color = `rgb(${r}, ${g}, ${b})`
        if (COLOR_CACHE.size >= COLOR_CACHE_MAX_SIZE) {
            // Clear half the cache when full
            const keysToDelete = Array.from(COLOR_CACHE.keys()).slice(
                0,
                COLOR_CACHE_MAX_SIZE / 2
            )
            keysToDelete.forEach((k) => COLOR_CACHE.delete(k))
        }
        COLOR_CACHE.set(key, color)
    }
    return color
}

const getAlphaColor = (mode: string, alpha: number): string => {
    const index = Math.round(alpha * 100)
    const clampedIndex = Math.max(0, Math.min(100, index))
    return mode === "dark"
        ? DARK_ALPHA_CACHE[clampedIndex]
        : LIGHT_ALPHA_CACHE[clampedIndex]
}

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
    mediaSource: string
    fontSize: number
    colorMode: "dark" | "light" | "color"
    alignment: "left" | "center" | "right"
    showPattern: boolean
    asciiChars: string
    isPlaying: boolean
    playOnCanvas: boolean
    invert: boolean
}

export default function AsciiTextBackground({
    mediaSource = "",
    fontSize = 10,
    colorMode = "dark",
    alignment = "center",
    showPattern = false,
    asciiChars = "@",
    isPlaying = true,
    playOnCanvas = false,
    invert = false,
}: Props) {
    // Determine if we're on the Framer canvas (editor) vs preview/published
    const isOnCanvas = RenderTarget.current() === RenderTarget.canvas

    // Effective playing state: respect isPlaying, but also check canvas state
    const effectiveIsPlaying = isPlaying && (playOnCanvas || !isOnCanvas)

    // Fixed color processing values
    const saturation = 1.0
    const contrast = 1.5
    const luminanceThreshold = 0.05
    const saturationBoost = 1.5
    const lightnessAdjust = 0.55
    const lightnessOffset = 0.25
    const lineHeight = 1.0
    const letterSpacing = 1.3
    const maxWidth = 1320

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isVideoRef = useRef(isVideoSource(mediaSource))
    const animationRef = useRef<number | null>(null)
    const linesRef = useRef<any[]>([])
    const lastUpdateRef = useRef(0)
    const configRef = useRef({
        fontSize,
        lineHeight,
        letterSpacing,
        fontFamily: '"IBM Plex Mono", monospace',
        scrambleSpeed: 40,
        alignment,
        maxWidth,
    })
    const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null)
    const mediaCanvasRef = useRef<HTMLCanvasElement | null>(null)
    // Optimization #2: Cache canvas context
    const mediaCanvasCtxRef = useRef<CanvasRenderingContext2D | null>(null)
    const mediaDimensionsRef = useRef({
        width: 0,
        height: 0,
        charsWidth: 0,
        charsHeight: 0,
        pixelOffsetX: 0,
        pixelOffsetY: 0,
        pixelWidth: 0,
        pixelHeight: 0,
        baseCharWidth: 0,
        baseCharHeight: 0,
    })
    const charWidthRef = useRef(0)
    const staticPixelsRef = useRef<ImageData | null>(null)
    const firstFrameRef = useRef<ImageData | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [mediaReady, setMediaReady] = useState(false)
    const [isInView, setIsInView] = useState(false)

    // Characters for density-based rendering in color mode
    const DENSITY_CHARS = asciiChars && asciiChars.length > 0 ? asciiChars : "@"

    // Intersection Observer to detect when component is in view
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setIsInView(entry.isIntersecting)
                })
            },
            {
                threshold: 0.1,
            }
        )

        observer.observe(container)

        return () => {
            observer.disconnect()
        }
    }, [])

    // Update config ref when props change
    useEffect(() => {
        configRef.current = {
            ...configRef.current,
            fontSize,
            alignment,
            maxWidth,
        }
    }, [fontSize, alignment, maxWidth])

    // Update isVideoRef when mediaSource changes
    useEffect(() => {
        isVideoRef.current = isVideoSource(mediaSource)
    }, [mediaSource])

    // Load media (image or video) when mediaSource changes
    useEffect(() => {
        if (!mediaSource) {
            setMediaReady(false)
            return
        }

        const isVideo = isVideoSource(mediaSource)
        isVideoRef.current = isVideo

        if (isVideo) {
            const video = document.createElement("video")
            video.src = mediaSource
            video.loop = true
            video.muted = true
            video.playsInline = true
            video.crossOrigin = "anonymous"
            video.preload = "auto"

            video.onloadeddata = () => {
                mediaRef.current = video
                const canvas = document.createElement("canvas")
                mediaCanvasRef.current = canvas
                // Optimization #2: Cache context immediately
                mediaCanvasCtxRef.current = canvas.getContext("2d", {
                    willReadFrequently: true,
                })

                // Capture first frame immediately for static display
                const tempCanvas = document.createElement("canvas")
                tempCanvas.width = video.videoWidth
                tempCanvas.height = video.videoHeight
                const tempCtx = tempCanvas.getContext("2d", {
                    willReadFrequently: true,
                })
                if (tempCtx) {
                    tempCtx.drawImage(video, 0, 0)
                    try {
                        const firstFrameData = tempCtx.getImageData(
                            0,
                            0,
                            video.videoWidth,
                            video.videoHeight
                        )
                        firstFrameRef.current = firstFrameData
                    } catch (e) {
                        // CORS error
                    }
                }

                setMediaReady(true)
            }

            video.load()

            return () => {
                video.pause()
                video.src = ""
                // Optimization #7: Clean up refs
                mediaRef.current = null
                mediaCanvasRef.current = null
                mediaCanvasCtxRef.current = null
                staticPixelsRef.current = null
                firstFrameRef.current = null
            }
        } else {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                mediaRef.current = img
                const canvas = document.createElement("canvas")
                mediaCanvasRef.current = canvas
                // Optimization #2: Cache context immediately
                mediaCanvasCtxRef.current = canvas.getContext("2d", {
                    willReadFrequently: true,
                })
                setMediaReady(true)
            }
            img.src = mediaSource

            return () => {
                img.src = ""
                // Optimization #7: Clean up refs
                mediaRef.current = null
                mediaCanvasRef.current = null
                mediaCanvasCtxRef.current = null
                staticPixelsRef.current = null
            }
        }
    }, [mediaSource])

    // Handle play/pause for video based on visibility and isPlaying prop
    useEffect(() => {
        if (!isVideoRef.current) return

        const video = mediaRef.current as HTMLVideoElement
        if (!video || !mediaReady) return

        if (isInView && effectiveIsPlaying) {
            staticPixelsRef.current = null
            video.play()
        } else {
            video.pause()
            // Capture current frame as static - use cached context
            const mCtx = mediaCanvasCtxRef.current
            const dims = mediaDimensionsRef.current
            if (mCtx && dims.charsWidth > 0) {
                mCtx.clearRect(0, 0, dims.charsWidth, dims.charsHeight)
                mCtx.drawImage(video, 0, 0, dims.charsWidth, dims.charsHeight)
                try {
                    staticPixelsRef.current = mCtx.getImageData(
                        0,
                        0,
                        dims.charsWidth,
                        dims.charsHeight
                    )
                } catch (e) {
                    // CORS error
                }
            }
        }
    }, [isInView, mediaReady, effectiveIsPlaying])

    // Optimization #6: Fixed useCallback dependencies - using module-level constants
    const generateContent = useCallback(
        (maxCharsPerLine: number) => {
            let content = ""

            if (Math.random() < 0.12) {
                content = " ".repeat(2 + Math.floor(Math.random() * 4))
            }

            while (content.length < maxCharsPerLine - 15) {
                const rand = Math.random()

                if (rand < 0.3) {
                    content +=
                        WORD_FRAGMENTS[
                            Math.floor(Math.random() * WORD_FRAGMENTS_LEN)
                        ]
                } else if (rand < 0.45) {
                    const len = 2 + Math.floor(Math.random() * 10)
                    for (let i = 0; i < len; i++) {
                        content +=
                            PATTERN_CHARS[
                                Math.floor(Math.random() * PATTERN_CHARS_LEN)
                            ]
                    }
                } else if (rand < 0.55) {
                    content += "0x"
                    const len = 2 + Math.floor(Math.random() * 6)
                    for (let i = 0; i < len; i++) {
                        content +=
                            CHARS.hex[Math.floor(Math.random() * CHARS_HEX_LEN)]
                    }
                } else if (rand < 0.65) {
                    content +=
                        OPERATORS[Math.floor(Math.random() * OPERATORS_LEN)]
                } else if (rand < 0.75) {
                    const brackets =
                        Math.random() < 0.33
                            ? ["(", ")"]
                            : Math.random() < 0.5
                              ? ["[", "]"]
                              : ["{", "}"]
                    content += brackets[0]
                    const innerLen = 1 + Math.floor(Math.random() * 8)
                    for (let i = 0; i < innerLen; i++) {
                        if (Math.random() < 0.3) {
                            content +=
                                WORD_FRAGMENTS[Math.floor(Math.random() * 30)]
                        } else {
                            content +=
                                PATTERN_CHARS[
                                    Math.floor(
                                        Math.random() * PATTERN_CHARS_LEN
                                    )
                                ]
                        }
                    }
                    content += brackets[1]
                } else if (rand < 0.85) {
                    content += WORD_FRAGMENTS[Math.floor(Math.random() * 40)]
                    if (Math.random() < 0.4) {
                        content +=
                            "_" + WORD_FRAGMENTS[Math.floor(Math.random() * 20)]
                    }
                    if (Math.random() < 0.3) {
                        content += Math.floor(Math.random() * 1000)
                    }
                } else {
                    const len = 1 + Math.floor(Math.random() * 4)
                    for (let i = 0; i < len; i++) {
                        content +=
                            CHARS.symbols[
                                Math.floor(Math.random() * CHARS_SYMBOLS_LEN)
                            ]
                    }
                }

                if (content.length < maxCharsPerLine - 10) {
                    const sepRand = Math.random()
                    if (sepRand < 0.45) {
                        content += " "
                    } else if (sepRand < 0.6) {
                        content +=
                            PUNCTUATION[
                                Math.floor(Math.random() * PUNCTUATION_LEN)
                            ] + " "
                    } else if (sepRand < 0.75) {
                        content += "  "
                    } else if (sepRand < 0.85) {
                        content += " | "
                    } else {
                        content += " - "
                    }
                }
            }

            while (content.length < maxCharsPerLine) {
                content +=
                    PATTERN_CHARS[Math.floor(Math.random() * PATTERN_CHARS_LEN)]
            }
            content = content.substring(0, maxCharsPerLine)

            return content.split("").map((char, i) => ({
                original: char,
                current: char,
                isSpace: char === " ",
                phaseOffset:
                    (i / content.length) * Math.PI + Math.random() * 0.5,
            }))
        },
        [] // Empty deps - all constants are module-level now
    )

    const initLines = useCallback(
        (
            canvas: HTMLCanvasElement,
            ctx: CanvasRenderingContext2D,
            currentColorMode: string,
            densityChars: string
        ) => {
            const config = configRef.current
            ctx.font = `${config.fontSize}px ${config.fontFamily}`
            const charWidth = ctx.measureText("M").width
            charWidthRef.current = charWidth

            const dpr = window.devicePixelRatio || 1
            const availableWidth = canvas.width / dpr
            const availableHeight = canvas.height / dpr

            const effectiveCharWidth = charWidth * config.letterSpacing
            const maxCharsPerLine = Math.floor(
                availableWidth / effectiveCharWidth
            )
            const maxLines = Math.floor(
                availableHeight / (config.fontSize * config.lineHeight)
            )

            const media = mediaRef.current
            if (media) {
                const mediaWidth = isVideoRef.current
                    ? (media as HTMLVideoElement).videoWidth
                    : (media as HTMLImageElement).width
                const mediaHeight = isVideoRef.current
                    ? (media as HTMLVideoElement).videoHeight
                    : (media as HTMLImageElement).height
                const mediaAspect = mediaWidth / mediaHeight

                const baseCharHeight = config.fontSize
                const baseCharWidth = charWidth

                let mediaPixelHeight = availableHeight * 0.95
                let mediaPixelWidth = mediaPixelHeight * mediaAspect

                if (mediaPixelWidth > availableWidth * 0.95) {
                    mediaPixelWidth = availableWidth * 0.95
                    mediaPixelHeight = mediaPixelWidth / mediaAspect
                }

                const maxWidthPx = config.maxWidth
                const constrainedWidthPx = Math.min(availableWidth, maxWidthPx)
                const containerOffsetPx =
                    (availableWidth - constrainedWidthPx) / 2

                let mediaPixelOffsetX: number
                if (config.alignment === "left") {
                    mediaPixelOffsetX = containerOffsetPx
                } else if (config.alignment === "right") {
                    mediaPixelOffsetX =
                        containerOffsetPx + constrainedWidthPx - mediaPixelWidth
                } else {
                    mediaPixelOffsetX =
                        containerOffsetPx +
                        (constrainedWidthPx - mediaPixelWidth) / 2
                }
                const mediaPixelOffsetY =
                    (availableHeight - mediaPixelHeight) / 2

                const charsWidth = Math.ceil(mediaPixelWidth / baseCharWidth)
                const charsHeight = Math.ceil(mediaPixelHeight / baseCharHeight)

                if (mediaCanvasRef.current) {
                    mediaCanvasRef.current.width = charsWidth
                    mediaCanvasRef.current.height = charsHeight

                    // Use cached context
                    const mCtx = mediaCanvasCtxRef.current
                    if (mCtx) {
                        mCtx.clearRect(0, 0, charsWidth, charsHeight)

                        if (isVideoRef.current) {
                            try {
                                mCtx.drawImage(
                                    media,
                                    0,
                                    0,
                                    charsWidth,
                                    charsHeight
                                )
                                staticPixelsRef.current = mCtx.getImageData(
                                    0,
                                    0,
                                    charsWidth,
                                    charsHeight
                                )
                            } catch (e) {
                                if (firstFrameRef.current) {
                                    const srcCanvas =
                                        document.createElement("canvas")
                                    srcCanvas.width =
                                        firstFrameRef.current.width
                                    srcCanvas.height =
                                        firstFrameRef.current.height
                                    const srcCtx = srcCanvas.getContext("2d")
                                    if (srcCtx) {
                                        srcCtx.putImageData(
                                            firstFrameRef.current,
                                            0,
                                            0
                                        )
                                        mCtx.drawImage(
                                            srcCanvas,
                                            0,
                                            0,
                                            charsWidth,
                                            charsHeight
                                        )
                                        try {
                                            staticPixelsRef.current =
                                                mCtx.getImageData(
                                                    0,
                                                    0,
                                                    charsWidth,
                                                    charsHeight
                                                )
                                        } catch (e2) {
                                            // Still failed
                                        }
                                    }
                                }
                            }
                        } else {
                            mCtx.drawImage(media, 0, 0, charsWidth, charsHeight)
                            try {
                                staticPixelsRef.current = mCtx.getImageData(
                                    0,
                                    0,
                                    charsWidth,
                                    charsHeight
                                )
                            } catch (e) {
                                // CORS error
                            }
                        }
                    }
                }

                mediaDimensionsRef.current = {
                    width: mediaWidth,
                    height: mediaHeight,
                    charsWidth,
                    charsHeight,
                    pixelOffsetX: mediaPixelOffsetX,
                    pixelOffsetY: mediaPixelOffsetY,
                    pixelWidth: mediaPixelWidth,
                    pixelHeight: mediaPixelHeight,
                    baseCharWidth,
                    baseCharHeight,
                }
            }

            const newLines: any[] = []
            const densityCharsLen = densityChars.length
            for (let i = 0; i < maxLines; i++) {
                const y = i * config.fontSize * config.lineHeight
                const chars = generateContent(maxCharsPerLine)

                if (currentColorMode === "color" && densityCharsLen > 0) {
                    for (const char of chars) {
                        if (!char.isSpace) {
                            char.current =
                                densityChars[
                                    Math.floor(Math.random() * densityCharsLen)
                                ]
                        }
                    }
                }

                newLines.push({
                    y,
                    lineIndex: i,
                    chars,
                    phaseOffset: Math.random() * Math.PI * 2,
                    maxCharsPerLine,
                })
            }

            linesRef.current = newLines
            return charWidth
        },
        [generateContent]
    )

    const updateLines = useCallback(
        (timestamp: number, currentColorMode: string, densityChars: string) => {
            const scrambleChars =
                currentColorMode === "color" ? densityChars : PATTERN_CHARS
            const scrambleCharsLen = scrambleChars.length

            for (const line of linesRef.current) {
                const linePhase = line.phaseOffset
                for (let i = 0; i < line.chars.length; i++) {
                    const char = line.chars[i]
                    if (char.isSpace) continue

                    const wave = Math.sin(
                        timestamp * 0.002 + linePhase + char.phaseOffset
                    )
                    const scrambleChance = ((wave + 1) / 2) * 0.2

                    if (
                        Math.random() < scrambleChance &&
                        scrambleCharsLen > 0
                    ) {
                        char.current =
                            scrambleChars[
                                Math.floor(Math.random() * scrambleCharsLen)
                            ]
                    }
                }
            }
        },
        [] // Empty deps - PATTERN_CHARS is module-level
    )

    const draw = useCallback(
        (
            ctx: CanvasRenderingContext2D,
            charWidth: number,
            playing: boolean,
            currentColorMode: string,
            currentShowPattern: boolean,
            chars: string
        ) => {
            const canvas = canvasRef.current
            if (!canvas) return

            const config = configRef.current
            const effectiveCharWidth = charWidth * config.letterSpacing
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.font = `${config.fontSize}px ${config.fontFamily}`
            ctx.textBaseline = "top"

            const dims = mediaDimensionsRef.current
            let pixels: ImageData | null = null

            const media = mediaRef.current

            if (isVideoRef.current) {
                if (playing && media && dims.charsWidth > 0) {
                    const video = media as HTMLVideoElement
                    if (!video.paused && !video.ended) {
                        // Use cached context
                        const mCtx = mediaCanvasCtxRef.current
                        if (mCtx) {
                            mCtx.clearRect(
                                0,
                                0,
                                dims.charsWidth,
                                dims.charsHeight
                            )
                            mCtx.drawImage(
                                video,
                                0,
                                0,
                                dims.charsWidth,
                                dims.charsHeight
                            )
                            try {
                                pixels = mCtx.getImageData(
                                    0,
                                    0,
                                    dims.charsWidth,
                                    dims.charsHeight
                                )
                            } catch (e) {
                                // CORS or other error
                            }
                        }
                    }
                }
                if (!pixels && staticPixelsRef.current) {
                    pixels = staticPixelsRef.current
                }
            } else {
                pixels = staticPixelsRef.current
            }

            // Optimization #3: Pre-compute constants outside the loop
            const halfEffectiveWidth = effectiveCharWidth / 2
            const halfLineHeight = (config.fontSize * config.lineHeight) / 2
            const pixelOffsetX = dims.pixelOffsetX
            const pixelOffsetY = dims.pixelOffsetY
            const pixelWidth = dims.pixelWidth
            const pixelHeight = dims.pixelHeight
            const charsWidth = dims.charsWidth
            const charsHeight = dims.charsHeight
            const hasPixels = pixels !== null
            const pixelData = pixels?.data

            // Pre-compute pattern style
            const patternStyle =
                currentColorMode === "dark"
                    ? DARK_PATTERN_ALPHA
                    : LIGHT_PATTERN_ALPHA

            for (const line of linesRef.current) {
                const baseY = line.y

                for (let i = 0; i < line.chars.length; i++) {
                    const char = line.chars[i].current
                    const baseX = i * effectiveCharWidth

                    const charCenterX = baseX + halfEffectiveWidth
                    const charCenterY = baseY + halfLineHeight

                    const relativeX = charCenterX - pixelOffsetX
                    const relativeY = charCenterY - pixelOffsetY

                    const isInMediaBounds =
                        hasPixels &&
                        relativeX >= 0 &&
                        relativeX < pixelWidth &&
                        relativeY >= 0 &&
                        relativeY < pixelHeight

                    let renderedMedia = false

                    if (isInMediaBounds) {
                        const mediaX = Math.floor(
                            (relativeX / pixelWidth) * charsWidth
                        )
                        const mediaY = Math.floor(
                            (relativeY / pixelHeight) * charsHeight
                        )

                        if (
                            mediaX >= 0 &&
                            mediaX < charsWidth &&
                            mediaY >= 0 &&
                            mediaY < charsHeight
                        ) {
                            const pixelIndex =
                                (mediaY * charsWidth + mediaX) * 4
                            const r = pixelData![pixelIndex]
                            const g = pixelData![pixelIndex + 1]
                            const b = pixelData![pixelIndex + 2]
                            const a = pixelData![pixelIndex + 3]

                            const luminance =
                                (0.299 * r + 0.587 * g + 0.114 * b) / 255

                            // When invert is true, render all pixels (rely on alpha check only)
                            // When false, filter out dark pixels below threshold
                            const luminanceCheck = invert
                                ? true
                                : luminance > luminanceThreshold
                            if (luminanceCheck && a > 20) {
                                renderedMedia = true

                                if (currentColorMode === "color") {
                                    const displayChar =
                                        chars.length > 0 ? char : "@"

                                    const rNorm = r / 255
                                    const gNorm = g / 255
                                    const bNorm = b / 255
                                    const max = Math.max(rNorm, gNorm, bNorm)
                                    const min = Math.min(rNorm, gNorm, bNorm)
                                    const l = (max + min) / 2

                                    let h = 0,
                                        s = 0
                                    if (max !== min) {
                                        const d = max - min
                                        s =
                                            l > 0.5
                                                ? d / (2 - max - min)
                                                : d / (max + min)
                                        if (max === rNorm)
                                            h =
                                                ((gNorm - bNorm) / d +
                                                    (gNorm < bNorm ? 6 : 0)) /
                                                6
                                        else if (max === gNorm)
                                            h = ((bNorm - rNorm) / d + 2) / 6
                                        else h = ((rNorm - gNorm) / d + 4) / 6
                                    }

                                    const newS = Math.min(
                                        1,
                                        s * saturation * saturationBoost
                                    )
                                    let newL = Math.pow(l, 1 / lightnessAdjust)
                                    newL = newL + lightnessOffset * newL

                                    let sr: number, sg: number, sb: number
                                    if (newS === 0) {
                                        sr = sg = sb = newL * 255
                                    } else {
                                        const q =
                                            newL < 0.5
                                                ? newL * (1 + newS)
                                                : newL + newS - newL * newS
                                        const p = 2 * newL - q
                                        sr = hue2rgb(p, q, h + 1 / 3) * 255
                                        sg = hue2rgb(p, q, h) * 255
                                        sb = hue2rgb(p, q, h - 1 / 3) * 255
                                    }

                                    sr = 128 + (sr - 128) * contrast
                                    sg = 128 + (sg - 128) * contrast
                                    sb = 128 + (sb - 128) * contrast

                                    sr = Math.max(
                                        0,
                                        Math.min(255, Math.round(sr))
                                    )
                                    sg = Math.max(
                                        0,
                                        Math.min(255, Math.round(sg))
                                    )
                                    sb = Math.max(
                                        0,
                                        Math.min(255, Math.round(sb))
                                    )

                                    // Optimization #5: Use color cache
                                    ctx.fillStyle = getCachedColor(sr, sg, sb)
                                    ctx.fillText(displayChar, baseX, baseY)
                                } else {
                                    const alpha = invert
                                        ? (a / 255) *
                                          Math.max(0.4, 0.15 + luminance * 0.85)
                                        : (a / 255) * (0.15 + luminance * 0.85)
                                    // Optimization #5: Use pre-computed alpha colors
                                    ctx.fillStyle = getAlphaColor(
                                        currentColorMode,
                                        alpha
                                    )
                                    ctx.fillText(char, baseX, baseY)
                                }
                            }
                        }
                    }

                    if (currentShowPattern && !renderedMedia) {
                        ctx.fillStyle = patternStyle
                        ctx.fillText(char, baseX, baseY)
                    }
                }
            }
        },
        [
            saturation,
            contrast,
            luminanceThreshold,
            saturationBoost,
            lightnessAdjust,
            lightnessOffset,
        ]
    )

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return

        let charWidth = 0

        const resize = () => {
            const dpr = window.devicePixelRatio || 1
            canvas.width = canvas.offsetWidth * dpr
            canvas.height = canvas.offsetHeight * dpr
            ctx.scale(dpr, dpr)
            charWidth = initLines(canvas, ctx, colorMode, DENSITY_CHARS)
        }

        const animate = (timestamp: number) => {
            const config = configRef.current

            if (
                isInView &&
                effectiveIsPlaying &&
                timestamp - lastUpdateRef.current > config.scrambleSpeed
            ) {
                lastUpdateRef.current = timestamp
                updateLines(timestamp, colorMode, DENSITY_CHARS)
            }

            draw(
                ctx,
                charWidth,
                effectiveIsPlaying,
                colorMode,
                showPattern,
                DENSITY_CHARS
            )

            if (isInView && effectiveIsPlaying) {
                animationRef.current = requestAnimationFrame(animate)
            }
        }

        resize()
        window.addEventListener("resize", resize)

        if (isInView && effectiveIsPlaying) {
            animationRef.current = requestAnimationFrame(animate)
        } else {
            draw(
                ctx,
                charWidth,
                effectiveIsPlaying,
                colorMode,
                showPattern,
                DENSITY_CHARS
            )
        }

        return () => {
            window.removeEventListener("resize", resize)
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [
        initLines,
        updateLines,
        draw,
        mediaReady,
        isInView,
        effectiveIsPlaying,
        colorMode,
        showPattern,
        alignment,
        fontSize,
        DENSITY_CHARS,
    ])

    // Optimization #7: Clean up on unmount
    useEffect(() => {
        return () => {
            linesRef.current = []
            staticPixelsRef.current = null
            firstFrameRef.current = null
            mediaRef.current = null
            mediaCanvasRef.current = null
            mediaCanvasCtxRef.current = null
        }
    }, [])

    return (
        <div
            ref={containerRef}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "transparent",
                }}
            />
        </div>
    )
}

addPropertyControls(AsciiTextBackground, {
    mediaSource: {
        type: ControlType.File,
        title: "Media",
        allowedFileTypes: [
            "jpg",
            "jpeg",
            "png",
            "gif",
            "webp",
            "mp4",
            "webm",
            "mov",
        ],
    },
    colorMode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["dark", "light", "color"],
        optionTitles: ["Dark", "Light", "Color"],
        defaultValue: "dark",
    },
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "center",
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        min: 6,
        max: 30,
        step: 1,
        defaultValue: 10,
    },
    asciiChars: {
        type: ControlType.String,
        title: "Characters",
        defaultValue: "@",
    },
    showPattern: {
        type: ControlType.Boolean,
        title: "Show Pattern",
        defaultValue: false,
    },
    isPlaying: {
        type: ControlType.Boolean,
        title: "Play Animation",
        defaultValue: true,
    },
    playOnCanvas: {
        type: ControlType.Boolean,
        title: "Play On Canvas",
        defaultValue: false,
        description:
            "When off, animation pauses in the Framer editor but plays in preview",
    },
    invert: {
        type: ControlType.Boolean,
        title: "Invert",
        defaultValue: false,
        description:
            "Enable for images with transparent backgrounds and dark shapes",
    },
})
