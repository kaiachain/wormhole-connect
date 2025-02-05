import React, { useEffect, useMemo, useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import Badge from '@mui/material/Badge';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Popover from '@mui/material/Popover';
import {
  usePopupState,
  bindTrigger,
  bindPopover,
} from 'material-ui-popup-state/hooks';
import Typography from '@mui/material/Typography';

import DownIcon from '@mui/icons-material/ExpandMore';
import UpIcon from '@mui/icons-material/ExpandLess';

import config from 'config';
import TokenIcon from 'icons/TokenIcons';

import type { ChainConfig, TokenConfig } from 'config/types';
import type { WalletData } from 'store/wallet';
import { isDisabledChain } from 'store/transferInput';
import ChainList from './ChainList';
import TokenList from './TokenList';
import { Chain } from '@wormhole-foundation/sdk';
import { Box } from '@mui/material';

const useStyles = makeStyles()((theme: any) => ({
  container: {
    marginTop: '4px',
  },
  card: {
    width: '100%',
    cursor: 'pointer',
    maxWidth: '420px',
    borderRadius: '8px',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    ':last-child': {
      padding: '16px 20px',
    },
  },
  chainSelector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: '0.4',
    cursor: 'not-allowed',
    clickEvent: 'none',
  },
  chainBadge: {
    padding: '2px',
    background:
      theme.palette.background.badge ?? theme.palette.background.default,
    borderRadius: '6px',
    border: `2px solid ${theme.palette.modal.background}`,
  },
}));

type Props = {
  chain?: Chain | undefined;
  chainList: Array<ChainConfig>;
  token?: string;
  sourceToken?: string;
  tokenList?: Array<TokenConfig> | undefined;
  isFetching?: boolean;
  setToken: (value: string) => void;
  setChain: (value: Chain) => void;
  wallet: WalletData;
  isSource: boolean;
};

const AssetPicker = (props: Props) => {
  const [showChainSearch, setShowChainSearch] = useState(false);
  const [selectedTokenChain, setSelectedTokenChain] = useState('');
  const { classes } = useStyles();

  const popupState = usePopupState({
    variant: 'popover',
    popupId: 'asset-picker',
  });

  // Side-effect to reset chain search visibility.
  // Popover close has an animation, which requires to wait
  // a tiny bit before resetting showChainSearch.
  // 300 ms is the reference wait time in a double-click, that's why
  // we can use it as the min wait before user re-opens the popover.
  useEffect(() => {
    if (!popupState.isOpen) {
      setTimeout(() => {
        setShowChainSearch(false);
      }, 300);
    }
  }, [popupState.isOpen]);

  // Pre-selecting first allowed chain, when asset picker is opened
  useEffect(() => {
    if (popupState.isOpen && !props.chain) {
      const firstAllowedChain = props.chainList.find(
        (chain) => !isDisabledChain(chain.key, props.wallet),
      );
      if (firstAllowedChain) {
        props.setChain(firstAllowedChain.key);
      }
    }
    // Re-run only when popup state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupState.isOpen]);

  const chainConfig: ChainConfig | undefined = useMemo(() => {
    return props.chain ? config.chains[props.chain] : undefined;
  }, [props.chain]);

  const tokenConfig: TokenConfig | undefined = useMemo(() => {
    return props.token ? config.tokens[props.token] : undefined;
  }, [props.token]);

  const badges = useMemo(() => {
    return (
      <Badge
        badgeContent={
          <>
            {chainConfig ? (
              <Box className={classes.chainBadge}>
                <TokenIcon icon={chainConfig?.icon} height={18} />
              </Box>
            ) : null}
          </>
        }
        sx={{
          marginRight: '8px',
          '& .MuiBadge-badge': {
            right: 2,
            top: 44,
          },
        }}
      >
        <TokenIcon icon={tokenConfig?.icon} height={48} />
      </Badge>
    );
  }, [chainConfig, classes.chainBadge, tokenConfig?.icon]);

  const selection = useMemo(() => {
    if (!chainConfig && !tokenConfig) {
      return (
        <Typography component={'div'} fontSize={16}>
          Select chain and token
        </Typography>
      );
    }

    return (
      <div>
        <Typography component={'div'} fontSize={16} fontWeight={700}>
          {tokenConfig?.symbol || 'Select token'}
        </Typography>
        <Typography component={'div'} fontSize={12}>
          {chainConfig?.displayName}
        </Typography>
      </div>
    );
  }, [chainConfig, tokenConfig]);

  return (
    <>
      <Card
        className={classes.card}
        variant="elevation"
        {...bindTrigger(popupState)}
      >
        <CardContent className={classes.cardContent}>
          <Typography
            className={classes.chainSelector}
            component={'div'}
            gap={1}
          >
            {badges}
            {selection}
          </Typography>
          {popupState.isOpen ? <UpIcon /> : <DownIcon />}
        </CardContent>
      </Card>
      <Popover
        {...bindPopover(popupState)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        className={classes.container}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <ChainList
          chainList={props.chainList}
          selectedChainConfig={chainConfig}
          showSearch={showChainSearch}
          setShowSearch={setShowChainSearch}
          wallet={props.wallet}
          onChainSelect={(key) => {
            props.setChain(key);
          }}
        />
        {!showChainSearch && chainConfig && (
          <TokenList
            tokenList={props.tokenList}
            isFetching={props.isFetching}
            selectedChainConfig={chainConfig}
            selectedToken={props.token}
            selectedTokenChain={selectedTokenChain}
            sourceToken={props.sourceToken}
            wallet={props.wallet}
            onSelectToken={(key: string) => {
              props.setToken(key);
              setSelectedTokenChain(chainConfig.key);
              popupState.close();
            }}
            isSource={props.isSource}
          />
        )}
      </Popover>
    </>
  );
};

export default AssetPicker;
