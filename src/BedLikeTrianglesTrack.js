import boxIntersect from 'box-intersect';

const calculate1DZoomLevel = (tilesetInfo, xScale, tileProxy, maxZoom = null) => {
  // offset by 2 because 1D tiles are more dense than 2D tiles
  // 1024 points per tile vs 256 for 2D tiles
  if (tilesetInfo.resolutions) {
    const zoomIndexX = tileProxy.calculateZoomLevelFromResolutions(
      tilesetInfo.resolutions, xScale,
      tilesetInfo.min_pos[0], tilesetInfo.max_pos[0] - 2,
    );

    return zoomIndexX;
  }

  // the tileProxy calculateZoomLevel function only cares about the
  // difference between the minimum and maximum position
  const xZoomLevel = tileProxy.calculateZoomLevel(xScale,
    tilesetInfo.min_pos[0],
    tilesetInfo.max_pos[0],
    tilesetInfo.bins_per_dimension || tilesetInfo.tile_size);

  let zoomLevel = Math.min(xZoomLevel, maxZoom || Number.MAX_SAFE_INTEGER);
  zoomLevel = Math.max(zoomLevel, 0);
  // console.log('xScale', this._xScale.domain(), this.maxZoom);
  // console.log('zoomLevel:', zoomLevel, this.tilesetInfo.min_pos[0],
  //   this.tilesetInfo.max_pos[0]);

  return zoomLevel;
};

const calculate1DVisibleTiles = (tilesetInfo, xScale, tileProxy) => {
  // if we don't know anything about this dataset, no point
  // in trying to get tiles
  if (!tilesetInfo) { return []; }

  // calculate the zoom level given the scales and the data bounds
  const zoomLevel = calculate1DZoomLevel(tilesetInfo, xScale, tileProxy);

  if (tilesetInfo.resolutions) {
    const sortedResolutions = tilesetInfo.resolutions
      .map(x => +x)
      .sort((a, b) => b - a);

    const xTiles = tileProxy.calculateTilesFromResolution(
      sortedResolutions[zoomLevel],
      xScale,
      tilesetInfo.min_pos[0], tilesetInfo.max_pos[0],
    );

    const tiles = xTiles.map(x => [zoomLevel, x]);
    return tiles;
  }

  // x doesn't necessary mean 'x' axis, it just refers to the relevant axis
  // (x if horizontal, y if vertical)
  const xTiles = tileProxy.calculateTiles(zoomLevel,
    xScale,
    tilesetInfo.min_pos[0],
    tilesetInfo.max_pos[0],
    tilesetInfo.max_zoom,
    tilesetInfo.max_width);

  const tiles = xTiles.map(x => [zoomLevel, x]);
  return tiles;
};

const tileToLocalId1D = tile => `${tile.join('.')}`;

const tileToRemoteId1D = tile => `${tile.join('.')}`;

const BedLikeTrianglesTrack = (HGC, ...args) => {
  if (!new.target) {
    throw new Error(
      'Uncaught TypeError: Class constructor cannot be invoked without "new"',
    );
  }

  // Services
  const { PIXI, slugid, d3Scale } = HGC.libraries;
  const { scaleLog } = d3Scale;

  class BedLikeTrianglesTrackClass extends HGC.tracks.TiledPixiTrack {
    initTile(tile) {
      this.renderTile(tile);
    }

    destroyTile(tile) {

    }

    tileToLocalId(tile) {
      return tileToLocalId1D(tile);
    }

    tileToRemoteId(tile) {
      return tileToRemoteId1D(tile);
    }

    calculateVisibleTiles() {
      const tiles = calculate1DVisibleTiles(this.tilesetInfo, this._xScale, HGC.services.tileProxy);

      this.setVisibleTiles(tiles);
    }

    renderTile(tile) {
      tile.graphics.clear();

      if (!tile.tileData.length) {
        return;
      }
      // tile.graphics.beginFill(0, 0.005);
      tile.drawnAtScale = this._xScale.copy();
      const opacityScale = scaleLog().domain([1, 1000]).range([1, 0.1]);


      // console.log('draw:', tile.tileId);
      for (const region of tile.tileData) {
        const xStart = this._xScale(region.xStart);
        const xEnd = this._xScale(region.xEnd);
        const xMiddle = this._xScale((region.xStart + region.xEnd) / 2);
        const yMiddle = (xEnd - xStart) / 2;

        const poly = [
          xStart, 0,
          xMiddle, yMiddle,
          xEnd, 0];

        const TIP_LINE_LENGTH = 10;


        const opacity = opacityScale(yMiddle);
        // console.log('yMiddle:', yMiddle, 'opacity:', opacity)
        tile.graphics.lineStyle(1, 0, opacity);
        tile.graphics.drawPolygon(poly);
        tile.graphics.lineStyle(2, 0xff0000, 1);

        // create a little line at the tip of each triangle
        tile.graphics.moveTo(xMiddle - TIP_LINE_LENGTH / 2, yMiddle );
        tile.graphics.lineTo(xMiddle + TIP_LINE_LENGTH / 2, yMiddle );

        // console.log('xMiddle :', xMiddle);
      }
    }

    draw() {
      for (const fetchedTileId in this.fetchedTiles) {
        const tile = this.fetchedTiles[fetchedTileId];
        // hasn't been rendered yet
        if (!tile.drawnAtScale) {
          return;
        }

        const tileK = (tile.drawnAtScale.domain()[1] - tile.drawnAtScale.domain()[0])
          / (this._xScale.domain()[1] - this._xScale.domain()[0]);
        const newRange = this._xScale.domain().map(tile.drawnAtScale);

        const posOffset = newRange[0];
        tile.graphics.scale.x = tileK;
        tile.graphics.scale.y = tileK;
        tile.graphics.position.x = -posOffset * tileK;
        // tile.graphics.position.y = this.position[1];
      }
    }

    setPosition(newPosition) {
      super.setPosition(newPosition);

      [this.pMain.position.x, this.pMain.position.y] = this.position;
    }

    zoomed(newXScale/* , newYScale */) {
      this.xScale(newXScale);

      this.refreshTiles();
      this.draw();
    }
  }

  return new BedLikeTrianglesTrackClass(...args);
};

const icon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="1.5"><path d="M4 2.1L.5 3.5v12l5-2 5 2 5-2v-12l-5 2-3.17-1.268" fill="none" stroke="currentColor"/><path d="M10.5 3.5v12" fill="none" stroke="currentColor" stroke-opacity=".33" stroke-dasharray="1,2,0,0"/><path d="M5.5 13.5V6" fill="none" stroke="currentColor" stroke-opacity=".33" stroke-width=".9969299999999999" stroke-dasharray="1.71,3.43,0,0"/><path d="M9.03 5l.053.003.054.006.054.008.054.012.052.015.052.017.05.02.05.024 4 2 .048.026.048.03.046.03.044.034.042.037.04.04.037.04.036.042.032.045.03.047.028.048.025.05.022.05.02.053.016.053.014.055.01.055.007.055.005.055v.056l-.002.056-.005.055-.008.055-.01.055-.015.054-.017.054-.02.052-.023.05-.026.05-.028.048-.03.046-.035.044-.035.043-.038.04-4 4-.04.037-.04.036-.044.032-.045.03-.046.03-.048.024-.05.023-.05.02-.052.016-.052.015-.053.012-.054.01-.054.005-.055.003H8.97l-.053-.003-.054-.006-.054-.008-.054-.012-.052-.015-.052-.017-.05-.02-.05-.024-4-2-.048-.026-.048-.03-.046-.03-.044-.034-.042-.037-.04-.04-.037-.04-.036-.042-.032-.045-.03-.047-.028-.048-.025-.05-.022-.05-.02-.053-.016-.053-.014-.055-.01-.055-.007-.055L4 10.05v-.056l.002-.056.005-.055.008-.055.01-.055.015-.054.017-.054.02-.052.023-.05.026-.05.028-.048.03-.046.035-.044.035-.043.038-.04 4-4 .04-.037.04-.036.044-.032.045-.03.046-.03.048-.024.05-.023.05-.02.052-.016.052-.015.053-.012.054-.01.054-.005L8.976 5h.054zM5 10l4 2 4-4-4-2-4 4z" fill="currentColor"/><path d="M7.124 0C7.884 0 8.5.616 8.5 1.376v3.748c0 .76-.616 1.376-1.376 1.376H3.876c-.76 0-1.376-.616-1.376-1.376V1.376C2.5.616 3.116 0 3.876 0h3.248zm.56 5.295L5.965 1H5.05L3.375 5.295h.92l.354-.976h1.716l.375.975h.945zm-1.596-1.7l-.592-1.593-.58 1.594h1.172z" fill="currentColor"/></svg>';

BedLikeTrianglesTrack.config = {
  type: 'bedlike-triangles',
  datatype: ['bedlike'],
  orientation: '1d-horizontal',
  name: 'BedLikeTrianglesTrack',
  thumbnail: new DOMParser().parseFromString(icon, 'text/xml').documentElement,
  availableOptions: [
  ],
  defaultOptions: {
  },
};

export default BedLikeTrianglesTrack;
