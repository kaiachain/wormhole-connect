import React, { useEffect, useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import { CENTER } from '../utils/style';
import noIcon from './Tokens/noIcon';
import { Route } from '../store/transferInput';
import WormholeIcon from './Routes/Wormhole';
import XLabsIcon from './Routes/XLabs';
import HashflowIcon from './Routes/Hashflow';
import CCTPIcon from './Routes/CCTP';

const useStyles = makeStyles<{ size: number }>()((theme, { size }) => ({
  container: {
    height: size,
    width: size,
    ...CENTER,
  },
  icon: {
    maxHeight: '100%',
    maxWidth: '100%',
  },
}));

export const getIcon = (route: Route) => {
  switch (route) {
    case Route.BRIDGE: {
      return WormholeIcon;
    }
    case Route.RELAY: {
      return XLabsIcon;
    }
    case Route.HASHFLOW: {
      return HashflowIcon;
    }
    case Route.CCTPRelay: {
      return CCTPIcon;
    }
    case Route.CCTPManual: {
      return CCTPIcon;
    }
    default: {
      return noIcon;
    }
  }
};

type Props = {
  route: Route;
  height?: number;
};

function RouteIcon(props: Props) {
  const size = props.height || 32;
  const { classes } = useStyles({ size });

  const [icon, setIcon] = useState(noIcon);

  useEffect(() => {
    if (props.route) {
      setIcon(getIcon(props.route!)!);
    } else {
      setIcon(noIcon);
    }
  }, [props.route]);

  return <div className={classes.container}>{icon}</div>;
}

export default RouteIcon;
