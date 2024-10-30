/**
 * MIT License
 *
 * Copyright (C) 2024 Huawei Device Co., Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { drawing, common2D } from '@kit.ArkGraphics2D';
import { parseSpreadValue, PathPotions, divideAndRound } from './Utils'
import { PositionEnum } from './PositionEnum';
import { Position } from './Position';
import { TextStyle } from './TextStyle';
import { MarkerError } from './MarkerError'
import { DefaultConstants } from './DefaultConstants'
import { ErrorCode } from './ErrorCode'
import { handleDynamicToString, convertHexToArgb } from './Utils'
import { RNNativeImageMarker } from '@rnoh/react-native-openharmony/generated/turboModules/RNNativeImageMarker'
import { MarkerInsets } from './MarkerInsets';
import { TextAlign } from './TextAlign';
import resourceManager from '@ohos.resourceManager';

export class TextOptions {
  private text: string | null;

  public setText(value: string | null) {
    this.text = value;
  }

  public getText(): string | null {
    return this.text;
  }

  private x: string | null;

  public setX(value: string | null) {
    this.x = value;
  }

  public getX(): string | null {
    return this.x;
  }

  private y: string | null;

  public setY(value: string | null) {
    this.y = value;
  }

  public getY(): string | null {
    return this.y;
  }

  private position: Position | null;

  public setPosition(value: Position | null) {
    this.position = value;
  }

  public getPosition(): Position | null {
    return this.position;
  }

  private style: TextStyle;

  public setStyle(value: TextStyle) {
    this.style = value;
  }

  public getStyle(): TextStyle {
    return this.style;
  }

  private maxWidth: number;

  public setMaxWidth(value: number) {
    this.maxWidth = value;
  }

  public getMaxWidth(): number {
    return this.maxWidth;
  }

  private maxHeight: number;

  public setMaxHeight(value: number) {
    this.maxHeight = value;
  }

  public getMaxHeight(): number {
    return this.maxHeight;
  }

  constructor(options: RNNativeImageMarker.TextOptions, maxWidth: number, maxHeight: number) {
    this.text = options.text;
    this.maxWidth = maxWidth
    this.maxHeight = maxHeight
    if (!this.text) {
      throw new MarkerError(ErrorCode.PARAMS_REQUIRED, "mark text is required");
    }
    const positionOptions = options.position || null;
    this.x = positionOptions?.X ? handleDynamicToString(positionOptions?.X) : null;
    this.y = positionOptions?.Y ? handleDynamicToString(positionOptions.Y) : null;
    this.style = new TextStyle(
      options.style
    )
    let font = new drawing.Font();
    font.setSize(this.style.getFontSize())
    let metrics = font.getMetrics();
    let textHeight = Math.abs(metrics.ascent)
    let textWidth = 0
    if (this.text.indexOf("\n") > 0) {
      let texts = this.text.split("\n")
      for (let index = 0; index < texts.length; index++) {
        let width = font.measureText(texts[index], drawing.TextEncoding.TEXT_ENCODING_UTF8)
        textWidth = textWidth > width ? textWidth : width
      }
    } else {
      textWidth = font.measureText(this.text, drawing.TextEncoding.TEXT_ENCODING_UTF8)
    }
    if (positionOptions) {
      this.position = positionOptions.position ?
      Position.getTextPosition(PositionEnum.getPosition(positionOptions.position), DefaultConstants.DEFAULT_MARGIN,
        this.maxWidth, this.maxHeight, textWidth, textHeight) : null;
      if (!this.position) {
        this.position = new Position(parseSpreadValue(this.x, this.maxWidth), parseSpreadValue(this.y, this.maxHeight))
      }
    } else {
      this.position = Position.getTextPosition(PositionEnum.TOP_LEFT, DefaultConstants.DEFAULT_MARGIN,
        this.maxWidth, this.maxHeight, textWidth, textHeight)
    }
  }


  applyStyle(
    canvas: drawing.Canvas,
    margin: number,
    positionEnum: string | null,
    x: string | null,
    y: string | null,
    style: TextStyle,
    maxWidth: number,
    maxHeight: number,
    typeFace: drawing.Typeface | undefined
  ) {

    let font = new drawing.Font();
    if (typeFace) {
      font.setTypeface(typeFace)
    }
    const textSize = style.getFontSize();
    font.setSize(textSize);
    let metrics = font.getMetrics();
    let textHeight = Math.abs(metrics.top)
    let length = 1
    let textWidth = 0
    if (this.text.indexOf("\n")) {
      let texts = this.text.split("\n");
      length = texts.length
      for (let index = 0; index < texts.length; index++) {
        const text = texts[index];
        let textWidths = font.measureText(text, drawing.TextEncoding.TEXT_ENCODING_UTF8);
        textWidth = textWidths > textWidth ? textWidths : textWidth
      }
    } else {
      textWidth = font.measureText(this.text, drawing.TextEncoding.TEXT_ENCODING_UTF8);
    }
    textWidth =
      textWidth >= maxWidth - 2 * DefaultConstants.DEFAULT_MARGIN ? maxWidth - 2 * DefaultConstants.DEFAULT_MARGIN :
        textWidth
    let bgInsets: MarkerInsets
    let bgRect: common2D.Rect = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    };

    if (style.getTextBackgroundStyle()) {
      ({ bgInsets, textWidth, bgRect } =
        this.drawBackground(bgInsets, style, maxWidth, maxHeight, textWidth, bgRect, textHeight, length, margin,
          positionEnum, x, y, canvas));
    } else {
      bgRect = this.defaultBackgroundReact(textWidth, textHeight, length, bgRect);
    }
    length = this.drawTextWithStyle(style, canvas, length, font, textWidth, textHeight, bgRect);
  }

  private drawTextWithStyle(style: TextStyle, canvas: drawing.Canvas, length: number, font: drawing.Font,
    textWidth: number,
    textHeight: number, bgRect: common2D.Rect) {
    let fontBrush = new drawing.Brush();
    let fontPen = new drawing.Pen();
    if (style.getShadowLayerStyle()) {
      const shadow = style.getShadowLayerStyle();
      const shadowLayer = drawing.ShadowLayer.create(shadow?.radius, shadow?.dx, shadow?.dy, shadow?.color);
      fontBrush.setShadowLayer(shadowLayer);
      fontPen.setShadowLayer(shadowLayer);
    }
    let strokeWidth = 2;
    if (style.getBold()) {
      strokeWidth = 4;
    }
    canvas.save()
    if (style.getRotate() != 0) {
      canvas.rotate(style.getRotate(), (bgRect.left + bgRect.right) / 2, (bgRect.top + bgRect.bottom) / 2);
    }
    fontPen.setStrokeWidth(strokeWidth);
    if (style.getColor()) {
      let fontColor = convertHexToArgb(style.getColor());
      fontBrush.setColor(fontColor);
      fontPen.setColor(fontColor);
    }
    canvas.attachPen(fontPen);
    canvas.attachBrush(fontBrush);
    if (this.text.indexOf("\n")) {
      let texts = this.text.split("\n");
      length = texts.length;
      for (let index = 0; index < texts.length; index++) {
        const text = texts[index].trim();
        this.drawText(font, text, textWidth, textHeight, canvas, index + 1);
      }
    } else {
      this.drawText(font, this.text, textWidth, textHeight, canvas, 1);
    }
    canvas.detachPen();
    canvas.detachBrush();
    canvas.restore()
    return length;
  }

  private defaultBackgroundReact(textWidth: number, textHeight: number, length: number,
    bgRect: common2D.Rect) {
    let left = this.position?.x
    let top = this.position?.y
    let right = this.position?.x + textWidth + 2 * DefaultConstants.DEFAULT_MARGIN
    let dived = length > 1 ? (length - 1) * DefaultConstants.DEFAULT_MARGIN : 0
    let bottom = this.position?.y + textHeight * length + 2 * DefaultConstants.DEFAULT_MARGIN + dived

    bgRect = {
      left: left,
      top: top,
      right: right,
      bottom: bottom
    };
    return bgRect;
  }

  private drawBackground(bgInsets: MarkerInsets, style: TextStyle, maxWidth: number, maxHeight: number,
    textWidth: number,
    bgRect: common2D.Rect, textHeight: number, length: number, margin: number, positionEnum: string | null,
    x: string | null, y: string | null, canvas: drawing.Canvas) {
    bgInsets = style.getTextBackgroundStyle().toEdgeInsets(maxWidth, maxHeight);
    let maxRemainingLength = maxWidth - 2 * DefaultConstants.DEFAULT_MARGIN - bgInsets.getLeft() - bgInsets.getRight();
    textWidth = textWidth >= maxRemainingLength ? maxRemainingLength : textWidth;
    bgRect =
      this.calculateBackgroundTypeReact(style, bgRect, bgInsets, maxWidth, textHeight, length, textWidth, maxHeight);
    let backgroundBrush = new drawing.Brush();
    if (style.getTextBackgroundStyle() && style.getTextBackgroundStyle()?.color) {
      backgroundBrush.setColor(style.getTextBackgroundStyle()?.color);
    }
    let position = { x: margin, y: margin };
    if (positionEnum !== null) {
      position =
        Position.getTextPosition(positionEnum, DefaultConstants.DEFAULT_MARGIN, maxWidth, maxHeight, textWidth,
          textHeight);
    } else {
      if (x !== null) {
        position.x = parseSpreadValue(x, maxWidth);
      }
      if (y !== null) {
        position.y = parseSpreadValue(y, maxHeight);
      }
    }
    canvas.save()
    if (style.getRotate() != 0) {
      canvas.rotate(style.getRotate(), (bgRect.left + bgRect.right) / 2, (bgRect.top + bgRect.bottom) / 2);
    }

    if (style.getTextBackgroundStyle().cornerRadius) {
      let paths: PathPotions[] = style.getTextBackgroundStyle().cornerRadius?.radii(bgRect);
      let path = this.getDrawPath(bgRect, paths);
      canvas.attachBrush(backgroundBrush);
      canvas.drawPath(path);
      canvas.detachBrush();
    } else {
      canvas.attachBrush(backgroundBrush);
      canvas.drawRect(bgRect);
      canvas.detachBrush();
    }
    canvas.restore()
    return { bgInsets, textWidth, bgRect };
  }

  private calculateBackgroundTypeReact(style: TextStyle, bgRect: common2D.Rect, bgInsets: MarkerInsets,
    maxWidth: number,
    textHeight: number, length: number, textWidth: number, maxHeight: number) {
    bgRect = {
      left: this.position?.x - bgInsets.getLeft(),
      top: this.position?.y - bgInsets.getTop(),
      right: this.position?.x + textWidth + bgInsets.getRight() + DefaultConstants.DEFAULT_MARGIN,
      bottom: this.position?.y + textHeight * length + bgInsets.getBottom() + 2 * DefaultConstants.DEFAULT_MARGIN
    };
    switch (style.getTextBackgroundStyle()?.type) {
      case 'stretchX':
        bgRect = {
          left: 0,
          top: this.position?.y - bgInsets.getTop() + DefaultConstants.DEFAULT_MARGIN,
          right: maxWidth,
          bottom: this.position?.y + textHeight * length + bgInsets.getBottom() + DefaultConstants.DEFAULT_MARGIN
        }
        break;
      case 'stretchY':
        bgRect = {
          left: this.position?.x - bgInsets.getLeft(),
          top: 0,
          right: this.position?.x + textWidth + bgInsets.getRight(),
          bottom: maxHeight
        }
        break;
    }
    return bgRect;
  }

  private drawText(font: drawing.Font, text: string, textWidth: number, textHeight: number, canvas: drawing.Canvas,
     index: number) {
    let textWidths = font.measureText(text, drawing.TextEncoding.TEXT_ENCODING_UTF8);
    let lineLength = text.length;
    let lineCount = 1;
    if (textWidths > textWidth) {
      textWidths = textWidth;
      lineLength = divideAndRound(text.length * textWidth, textWidths, 3);
      lineCount = Math.ceil(text.length / lineLength);
    }
    let textAlign = this.style.getTextAlign();
    let x = this.position?.x;
    if (textAlign == TextAlign.CENTER) {
      x = x + textWidth / 2 - textWidths/2
    } else if (textAlign == TextAlign.RIGHT) {
      x = x + textWidth - textWidths
    }
    let start = 0;
    let y = this.position?.y + textHeight * index;
    let skewX = 0;
    if (this.style.getItalic() || this.style.getSkewX()) {
      skewX = DefaultConstants.DEFAULT_ITALIC;
      if (this.style.getSkewX()) {
        skewX = -this.style.getSkewX();
      }
      font.setSkewX(skewX)
    }
    for (let index = 0; index < lineCount; index++) {
      const writeText = text.substring(start, start + lineLength);
      const textblob = drawing.TextBlob.makeFromString(writeText, font, drawing.TextEncoding.TEXT_ENCODING_UTF8);
      canvas.drawTextBlob(textblob, x, y);
      start = start + lineLength - 1;
      if (this.style.getUnderline()) {
        this.drawUnderline(x, y, textWidths, textHeight, canvas);
      }
      if (this.style.getStrikeThrough()) {
        this.drawStrikeThrough(x, y, textWidths, textHeight, canvas)
      }
    }
  }

  private drawUnderline(x: number, y: number, textWidths: number, textHeight: number, canvas: drawing.Canvas) {
    let x0 = x;
    let y0 = y + textHeight / 4;
    let x1 = x0 + textWidths;
    let y1 = y + textHeight / 4;
    canvas.drawLine(x0, y0, x1, y1);
  }

  private drawStrikeThrough(x: number, y: number, textWidths: number, textHeight: number, canvas: drawing.Canvas) {
    let x0 = x
    let y0 = y - textHeight / 4
    let x1 = x0 + textWidths
    let y1 = y - textHeight / 4
    canvas.drawLine(x0, y0, x1, y1)
  }

  getDrawPath(rect: common2D.Rect, paths: PathPotions[]): drawing.Path {
    let path = new drawing.Path();
    // topLeftPath
    let topLeftPath = paths[0]
    if (topLeftPath) {
      path.moveTo(topLeftPath.startX, topLeftPath.startY);
      path.quadTo(topLeftPath.ctrX, topLeftPath.ctrY, topLeftPath.endX, topLeftPath.endY)
    } else {
      path.moveTo(rect.left, rect.top)
    }
    let topRightPath = paths[1]

    if (topRightPath) {
      path.lineTo(topRightPath.startX, topRightPath.startY)
      path.quadTo(topRightPath.ctrX, topRightPath.ctrY, topRightPath.endX, topRightPath.endY)
    } else {
      path.lineTo(rect.right, rect.top)
    }
    let bottomRightPath = paths[2]
    if (bottomRightPath) {
      path.lineTo(bottomRightPath.startX, bottomRightPath.startY)
      path.quadTo(bottomRightPath.ctrX, bottomRightPath.ctrY, bottomRightPath.endX, bottomRightPath.endY)
    } else {
      path.lineTo(rect.right, rect.bottom)
    }
    let bottomLeftPath = paths[3]
    if (bottomLeftPath) {
      path.lineTo(bottomLeftPath.startX, bottomLeftPath.startY)
      path.quadTo(bottomLeftPath.ctrX, bottomLeftPath.ctrY, bottomLeftPath.endX, bottomLeftPath.endY)
    } else {
      path.lineTo(rect.left, rect.bottom)
    }
    path.close()
    return path;
  }

  drawTextUnderLine(position: Position, canvas: drawing.Canvas, textWidth) {
    let x0, y0, x1, y1 = 0;
    y0 = position.y + DefaultConstants.DEFAULT_MARGIN
    y1 = position.y + DefaultConstants.DEFAULT_MARGIN
    x0 = position.x + DefaultConstants.DEFAULT_MARGIN
    x1 = position.x + textWidth + DefaultConstants.DEFAULT_MARGIN
    canvas.drawLine(x0, y0, x1, y1)
  }

  drawTextStrikeThroughLine(position: Position, canvas: drawing.Canvas, textWidth, height) {
    let x0, y0, x1, y1 = 0;
    x0 = position.x + DefaultConstants.DEFAULT_MARGIN
    x1 = Math.abs(position.x) + textWidth + DefaultConstants.DEFAULT_MARGIN
    y0 = position.y - height / 2 / 3
    y1 = position.y - height / 2 / 3
    canvas.drawLine(x0, y0, x1, y1)
  }
}

